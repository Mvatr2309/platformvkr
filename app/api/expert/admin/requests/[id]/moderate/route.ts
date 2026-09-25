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
//
// Переход атомарный: статус меняется, только если запрос в ожидаемом статусе и не
// менялся с тех пор, как модератор загрузил очередь (updatedAt). Иначе из старой вкладки
// можно одобрить анкету, которую студент уже переписал, или два решения пройдут оба.
// Уведомления уходят только после успешного перехода.

/** Из каких статусов разрешено действие. Отклонить можно и запрос на доработке:
 *  иначе он застревает, если студент не вернулся или эксперт скрыл карточку. */
const ALLOWED_FROM: Record<string, ("NEW" | "NEEDS_REVISION")[]> = {
  approve: ["NEW"],
  return: ["NEW"],
  reject: ["NEW", "NEEDS_REVISION"],
};

const STALE = "Запрос изменился, пока вы его смотрели — обновите очередь";

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
  // Версия запроса, которую видел модератор. Без неё — только проверка статуса
  const seenAt = typeof body.updatedAt === "string" ? new Date(body.updatedAt) : null;
  const seenVersion = seenAt && !Number.isNaN(seenAt.getTime()) ? { updatedAt: seenAt } : {};

  const allowedFrom = ALLOWED_FROM[action];
  if (!allowedFrom) {
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  }
  if (action !== "approve" && !comment) {
    return NextResponse.json(
      {
        error:
          action === "return"
            ? "Напишите комментарий — студент увидит, что исправить"
            : "Причина отклонения обязательна — студент её увидит",
      },
      { status: 400 }
    );
  }

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
  if (!(allowedFrom as string[]).includes(req.status)) {
    return NextResponse.json({ error: "Этот запрос уже обработан" }, { status: 409 });
  }

  const status =
    action === "approve"
      ? "APPROVED_BY_MODERATOR"
      : action === "return"
        ? "NEEDS_REVISION"
        : "REJECTED_BY_MODERATOR";

  const moved = await prisma.expertRequest.updateMany({
    where: { id, status: { in: allowedFrom }, ...seenVersion },
    data: {
      status,
      // При одобрении комментарий по желанию и адресован студенту (M1).
      // Пустой затирает комментарий прошлого возврата: он уже не актуален.
      moderatorComment: comment || null,
      moderatedById: guard.session.user.id,
      moderatedAt: new Date(),
    },
  });
  if (moved.count === 0) {
    return NextResponse.json({ error: STALE }, { status: 409 });
  }

  const student = req.student.user;
  if (action === "approve") {
    await notifyExpertApproved(req.expert.userId, req.expert.user.email, student.name || "Студент");
  } else if (action === "return") {
    await notifyStudentReturned(student.id, student.email, comment);
  } else {
    await notifyStudentRejected(student.id, student.email, "модератором", comment);
  }

  return NextResponse.json({ status });
}
