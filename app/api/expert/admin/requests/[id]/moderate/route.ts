import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isGuardError } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import {
  notifyExpertApproved,
  notifyStudentRejected,
  notifyStudentReturned,
} from "@/lib/expert-requests";

// POST /api/expert/admin/requests/[id]/moderate — решение модератора (08.13, M1).
// Три действия: одобрить (комментарий по желанию), вернуть на доработку и отклонить
// (комментарий обязателен). Комментарий видит студент в своём кабинете.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const comment = String(body.comment || "").trim();

  const req = await prisma.expertRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      student: { select: { user: { select: { id: true, name: true, email: true } } } },
      expert: { select: { userId: true, user: { select: { email: true } } } },
    },
  });

  if (!req) {
    return NextResponse.json({ error: "Запрос не найден" }, { status: 404 });
  }
  if (req.status !== "NEW") {
    return NextResponse.json(
      { error: "Этот запрос уже обработан" },
      { status: 409 }
    );
  }

  const now = new Date();

  if (action === "reject") {
    if (!comment) {
      return NextResponse.json(
        { error: "Причина отклонения обязательна — студент её увидит" },
        { status: 400 }
      );
    }
    await prisma.expertRequest.update({
      where: { id },
      data: {
        status: "REJECTED_BY_MODERATOR",
        moderatorComment: comment,
        moderatedById: guard.session.user.id,
        moderatedAt: now,
      },
    });
    await notifyStudentRejected(
      req.student.user.id,
      req.student.user.email,
      "модератором",
      comment
    );
    return NextResponse.json({ status: "REJECTED_BY_MODERATOR" });
  }

  if (action === "return") {
    if (!comment) {
      return NextResponse.json(
        { error: "Напишите комментарий — студент увидит, что исправить" },
        { status: 400 }
      );
    }
    await prisma.expertRequest.update({
      where: { id },
      data: {
        status: "NEEDS_REVISION",
        moderatorComment: comment,
        moderatedById: guard.session.user.id,
        moderatedAt: now,
      },
    });
    await notifyStudentReturned(req.student.user.id, req.student.user.email, comment);
    return NextResponse.json({ status: "NEEDS_REVISION" });
  }

  if (action === "approve") {
    await prisma.expertRequest.update({
      where: { id },
      data: {
        status: "APPROVED_BY_MODERATOR",
        // Комментарий при одобрении по желанию и адресован студенту (M1).
        // Пустой затирает комментарий прошлого возврата: он уже не актуален.
        moderatorComment: comment || null,
        moderatedById: guard.session.user.id,
        moderatedAt: now,
      },
    });
    await notifyExpertApproved(
      req.expert.userId,
      req.expert.user.email,
      req.student.user.name || "Студент"
    );
    return NextResponse.json({ status: "APPROVED_BY_MODERATOR" });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
