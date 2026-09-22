import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types/roles";

// POST /api/expert/requests/[id]/feedback — обратная связь по консультации (08.16).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 5.4)
//
// Отвечать можно, когда система спросила, то есть в статусе AWAITING_FEEDBACK.
// Ответ студента закрывает запрос; ответ эксперта — нет, потому что для метрики
// нужен именно ответ студента, а эксперт может ответить и раньше, и позже.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const metHappened = Boolean(body.metHappened);
  const comment = String(body.comment || "").trim();
  const ratingRaw = Number(body.rating);

  const req = await prisma.expertRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      student: { select: { userId: true } },
      expert: { select: { userId: true } },
    },
  });
  if (!req) {
    return NextResponse.json({ error: "Запрос не найден" }, { status: 404 });
  }

  // Кто отвечает: студент-автор или эксперт, которому запрос адресован
  let authorSide: "STUDENT" | "EXPERT";
  if (req.student.userId === session.user.id) {
    authorSide = "STUDENT";
  } else if (req.expert.userId === session.user.id) {
    authorSide = "EXPERT";
  } else {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  if (req.status !== "AWAITING_FEEDBACK") {
    return NextResponse.json(
      { error: "Обратную связь можно оставить, когда система её запросит" },
      { status: 409 }
    );
  }

  // Оценку ставит только студент, 1–5
  let rating: number | null = null;
  if (authorSide === UserRole.STUDENT && Number.isFinite(ratingRaw)) {
    rating = Math.min(5, Math.max(1, Math.round(ratingRaw)));
  }

  await prisma.expertRequestFeedback.upsert({
    where: { requestId_authorSide: { requestId: id, authorSide } },
    update: { metHappened, rating, comment: comment || null },
    create: {
      requestId: id,
      authorSide,
      metHappened,
      rating,
      comment: comment || null,
    },
  });

  // Ответ студента закрывает запрос (08.16)
  if (authorSide === "STUDENT") {
    await prisma.expertRequest.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date(), closedWithoutFeedback: false },
    });
    return NextResponse.json({ status: "CLOSED" });
  }

  return NextResponse.json({ status: req.status });
}
