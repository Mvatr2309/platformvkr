import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyContactsExchanged, notifyStudentRejected } from "@/lib/expert-requests";

// POST /api/expert/requests/[id]/decision — решение эксперта (08.14, 08.15).
// Принять или отклонить может только тот эксперт, которому запрос адресован.
// Принятие и отправка контактов — один переход в одной транзакции: отдельного
// наблюдаемого статуса «принят» нет, факт фиксирует acceptedAt.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Сверяем с карточкой эксперта, а не с userId запроса
  const card = await prisma.expertProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, contact: true, user: { select: { name: true, email: true } } },
  });
  if (!card) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const comment = String(body.comment || "").trim();

  const req = await prisma.expertRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      expertId: true,
      student: {
        select: {
          contact: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!req || req.expertId !== card.id) {
    return NextResponse.json({ error: "Запрос не найден" }, { status: 404 });
  }
  if (req.status !== "APPROVED_BY_MODERATOR") {
    return NextResponse.json(
      { error: "По этому запросу решение уже принято или он ещё не прошёл модерацию" },
      { status: 409 }
    );
  }

  if (action === "reject") {
    if (!comment) {
      return NextResponse.json({ error: "Укажите причину отказа" }, { status: 400 });
    }
    await prisma.expertRequest.update({
      where: { id },
      data: { status: "REJECTED_BY_EXPERT", expertComment: comment },
    });
    await notifyStudentRejected(
      req.student.user.id,
      req.student.user.email,
      "экспертом",
      comment
    );
    return NextResponse.json({ status: "REJECTED_BY_EXPERT" });
  }

  if (action === "accept") {
    const now = new Date();
    await prisma.expertRequest.update({
      where: { id },
      data: {
        status: "CONTACTS_SENT",
        acceptedAt: now,
        contactsSentAt: now, // точка отсчёта 7 дней до сбора обратной связи
      },
    });
    await notifyContactsExchanged({
      studentUserId: req.student.user.id,
      studentEmail: req.student.user.email,
      studentName: req.student.user.name || "Студент",
      studentContact: req.student.contact || "контакт не указан",
      expertUserId: session.user.id,
      expertEmail: card.user.email,
      expertName: card.user.name || "Эксперт",
      expertContact: card.contact || "контакт не указан",
    });
    return NextResponse.json({ status: "CONTACTS_SENT" });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
