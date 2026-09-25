import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types/roles";
import { getSpacesAccess } from "@/lib/expert-access";
import { CATALOG_WHERE } from "@/lib/expert-catalog";
import { parseRequestForm, ownProjectOrNull, notifyModerators } from "@/lib/expert-requests";

// PATCH /api/expert/requests/[id] — студент исправляет запрос, возвращённый на доработку (M1).
// Источник: specs/08-FR-08-requirements-v2.md (M1)
//
// Исправить можно только свой запрос и только в статусе «На доработке». После отправки
// запрос возвращается модератору в «Новые». Эксперт тот же: сменить его нельзя.
// Комментарий модератора остаётся — при повторной проверке он видит, что просил.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (session.user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  // Доступ по когорте проверяем на сервере, как и при отправке (08.07)
  const access = await getSpacesAccess();
  if (!access || access.expert.state !== "OPEN") {
    return NextResponse.json({ error: "Раздел недоступен" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const req = await prisma.expertRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        expertId: true,
        student: { select: { id: true, userId: true, direction: true, course: true } },
      },
    });

    // Чужой запрос для студента не существует
    if (!req || req.student.userId !== session.user.id) {
      return NextResponse.json({ error: "Запрос не найден" }, { status: 404 });
    }
    if (req.status !== "NEEDS_REVISION") {
      return NextResponse.json(
        { error: "Исправить можно только запрос, возвращённый на доработку" },
        { status: 409 }
      );
    }

    const form = parseRequestForm(await request.json());
    if ("error" in form) {
      return NextResponse.json({ error: form.error }, { status: 400 });
    }
    const { fields } = form;

    // Пока запрос был на доработке, эксперт мог скрыть карточку
    const expert = await prisma.expertProfile.findFirst({
      where: { id: req.expertId, ...CATALOG_WHERE },
      select: { id: true },
    });
    if (!expert) {
      return NextResponse.json(
        { error: "Эксперт сейчас не принимает запросы — выберите другого в каталоге" },
        { status: 409 }
      );
    }

    // Статус меняем условно: двойной клик не отправит запрос модератору дважды
    const updated = await prisma.expertRequest.updateMany({
      where: { id, status: "NEEDS_REVISION" },
      data: {
        ...fields,
        projectId: await ownProjectOrNull(fields.projectId, req.student.id),
        // Повторная отправка — тоже отправка: снимок профиля на её момент
        directionSnapshot: req.student.direction,
        courseSnapshot: req.student.course,
        status: "NEW",
      },
    });
    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Исправить можно только запрос, возвращённый на доработку" },
        { status: 409 }
      );
    }

    await notifyModerators(id, session.user.name || "Студент", { resubmitted: true });

    return NextResponse.json({ status: "NEW" });
  } catch {
    return NextResponse.json({ error: "Ошибка отправки запроса" }, { status: 500 });
  }
}
