import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isGuardError } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// FR-08: какие потоки студентов видят экспертную трубу (08.07).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 4)
//
// Потоки берём из существующего справочника cohorts — отдельного списка
// когорт не заводим. Отдельной «даты открытия» нет: галочка и есть механизм.

// GET /api/expert/admin/access — потоки, их состояние и число студентов
export async function GET() {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const [cohortValues, access, grouped, noCohortCount] = await Promise.all([
    prisma.dictionaryValue.findMany({
      where: { dictionary: { type: "cohorts" } },
      orderBy: { sortOrder: "asc" },
      select: { value: true },
    }),
    prisma.expertPipelineCohortAccess.findMany({
      select: { cohort: true, isOpen: true },
    }),
    prisma.studentProfile.groupBy({
      by: ["cohort"],
      _count: { _all: true },
    }),
    // Пустая когорта = доступа нет. Такие студенты не должны потеряться молча.
    prisma.studentProfile.count({ where: { cohort: "" } }),
  ]);

  const openMap = new Map(access.map((a) => [a.cohort, a.isOpen]));
  const countMap = new Map(grouped.map((g) => [g.cohort, g._count._all]));

  const cohorts = cohortValues.map((c) => ({
    cohort: c.value,
    isOpen: openMap.get(c.value) ?? false,
    students: countMap.get(c.value) ?? 0,
  }));

  // Значения, которых нет в справочнике, но которые стоят у студентов —
  // например, справочник переименовали уже после присвоения когорты
  const known = new Set(cohortValues.map((c) => c.value));
  const orphan = grouped
    .filter((g) => g.cohort !== "" && !known.has(g.cohort))
    .map((g) => ({
      cohort: g.cohort,
      isOpen: openMap.get(g.cohort) ?? false,
      students: g._count._all,
    }));

  return NextResponse.json({
    cohorts,
    orphanCohorts: orphan,
    studentsWithoutCohort: noCohortCount,
  });
}

// PUT /api/expert/admin/access — открыть или закрыть поток
export async function PUT(request: NextRequest) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  try {
    const { cohort, isOpen } = await request.json();
    if (typeof cohort !== "string" || !cohort.trim()) {
      return NextResponse.json({ error: "Поток не указан" }, { status: 400 });
    }

    const record = await prisma.expertPipelineCohortAccess.upsert({
      where: { cohort: cohort.trim() },
      update: { isOpen: Boolean(isOpen) },
      create: { cohort: cohort.trim(), isOpen: Boolean(isOpen) },
    });

    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
