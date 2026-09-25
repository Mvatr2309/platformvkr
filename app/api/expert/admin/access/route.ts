import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isGuardError } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// FR-08: какие потоки студентов видят экспертную трубу (08.07) и «Платформу ВКР» (A1).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 4), specs/08-FR-08-requirements-v2.md (A1)
//
// Потоки берём из существующего справочника cohorts — отдельного списка
// когорт не заводим. Отдельной «даты открытия» нет: галочка и есть механизм.
// Два флага независимы: поток может видеть трубу и не видеть платформу.

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
      select: { cohort: true, isOpen: true, platformOpen: true },
    }),
    prisma.studentProfile.groupBy({
      by: ["cohort"],
      _count: { _all: true },
    }),
    // Пустая когорта = доступа нет. Такие студенты не должны потеряться молча.
    prisma.studentProfile.count({ where: { cohort: "" } }),
  ]);

  const accessMap = new Map(access.map((a) => [a.cohort, a]));
  const countMap = new Map(grouped.map((g) => [g.cohort, g._count._all]));

  // Нет записи — закрыто и то и другое (A1)
  const flags = (cohort: string) => ({
    isOpen: accessMap.get(cohort)?.isOpen ?? false,
    platformOpen: accessMap.get(cohort)?.platformOpen ?? false,
  });

  const cohorts = cohortValues.map((c) => ({
    cohort: c.value,
    ...flags(c.value),
    students: countMap.get(c.value) ?? 0,
  }));

  // Значения, которых нет в справочнике, но которые стоят у студентов —
  // например, справочник переименовали уже после присвоения когорты
  const known = new Set(cohortValues.map((c) => c.value));
  const orphan = grouped
    .filter((g) => g.cohort !== "" && !known.has(g.cohort))
    .map((g) => ({
      cohort: g.cohort,
      ...flags(g.cohort),
      students: g._count._all,
    }));

  return NextResponse.json({
    cohorts,
    orphanCohorts: orphan,
    studentsWithoutCohort: noCohortCount,
  });
}

// PUT /api/expert/admin/access — открыть или закрыть потоку трубу и/или платформу.
// Меняются только переданные флаги: галочка трубы не задевает платформу и наоборот.
export async function PUT(request: NextRequest) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  try {
    const { cohort, isOpen, platformOpen } = await request.json();
    if (typeof cohort !== "string" || !cohort.trim()) {
      return NextResponse.json({ error: "Поток не указан" }, { status: 400 });
    }

    const data: { isOpen?: boolean; platformOpen?: boolean } = {};
    if (typeof isOpen === "boolean") data.isOpen = isOpen;
    if (typeof platformOpen === "boolean") data.platformOpen = platformOpen;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Не указано, что открыть или закрыть" }, { status: 400 });
    }

    const record = await prisma.expertPipelineCohortAccess.upsert({
      where: { cohort: cohort.trim() },
      update: data,
      create: {
        cohort: cohort.trim(),
        isOpen: data.isOpen ?? false,
        platformOpen: data.platformOpen ?? false,
      },
    });

    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
