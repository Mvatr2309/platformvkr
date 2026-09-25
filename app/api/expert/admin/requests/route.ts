import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isGuardError } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// GET /api/expert/admin/requests — очередь модерации (08.13).
// По умолчанию новые; ?status=ALL показывает всё, чтобы видеть историю решений.
// Порядок — по последнему изменению: исправленный после доработки запрос поднимается
// наверх (M1). updatedAt отдаётся и как версия для атомарного решения модератора.
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const status = request.nextUrl.searchParams.get("status") || "NEW";

  const requests = await prisma.expertRequest.findMany({
    where: status === "ALL" ? {} : { status: status as never },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      topic: true,
      expectedResult: true,
      ownProgress: true,
      problemArea: true,
      materialsUrl: true,
      moderatorComment: true,
      expertComment: true,
      directionSnapshot: true,
      courseSnapshot: true,
      createdAt: true,
      updatedAt: true,
      moderatedAt: true,
      project: { select: { id: true, title: true } },
      student: { select: { user: { select: { name: true } } } },
      expert: {
        select: { position: true, workplace: true, user: { select: { name: true } } },
      },
    },
  });

  const counts = await prisma.expertRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  return NextResponse.json({
    requests,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  });
}
