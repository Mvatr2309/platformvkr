import { NextResponse } from "next/server";
import { requireAdmin, isGuardError } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// GET /api/expert/admin/metrics — конверсия запрос → встреча (08.19).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 5.4)
//
// Три категории, а не две. Запросы, закрытые джобой без ответа студента,
// идут в «нет данных»: если считать их несостоявшимися, молчуны систематически
// занизят конверсию и метрика перестанет отражать реальность.

export async function GET() {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const [byStatus, finished, ratings] = await Promise.all([
    prisma.expertRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    // Запросы, дошедшие до обмена контактами: только по ним имеет смысл считать встречи
    prisma.expertRequest.findMany({
      where: { status: { in: ["CONTACTS_SENT", "AWAITING_FEEDBACK", "CLOSED"] } },
      select: {
        id: true,
        status: true,
        closedWithoutFeedback: true,
        feedbacks: { select: { authorSide: true, metHappened: true, rating: true } },
      },
    }),
    prisma.expertRequestFeedback.findMany({
      where: { rating: { not: null } },
      select: { rating: true },
    }),
  ]);

  let met = 0;
  let notMet = 0;
  let noData = 0;

  for (const r of finished) {
    if (r.feedbacks.length === 0) {
      noData++;
      continue;
    }
    // Встреча засчитывается, если её подтвердила хотя бы одна сторона
    if (r.feedbacks.some((f) => f.metHappened)) met++;
    else notMet++;
  }

  const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
  const total = byStatus.reduce((sum, s) => sum + s._count._all, 0);
  const contactsExchanged = finished.length;

  const avgRating =
    ratings.length > 0
      ? Math.round(
          (ratings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratings.length) * 10
        ) / 10
      : null;

  return NextResponse.json({
    total,
    statusCounts,
    contactsExchanged,
    // Конверсия считается от числа обменов контактами, а не от всех запросов:
    // отклонённые модератором и экспертом до встречи дойти не могли
    meetings: { met, notMet, noData },
    conversion:
      contactsExchanged > 0 ? Math.round((met / contactsExchanged) * 1000) / 10 : null,
    avgRating,
    ratingsCount: ratings.length,
  });
}
