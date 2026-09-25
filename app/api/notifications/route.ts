import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseSpace,
  otherSpace,
  spaceWhere,
  SUPPORT_REPLY_WHERE,
  type NotificationSpace,
} from "@/lib/notification-space";
import { isPlatformClosedForStudent } from "@/lib/expert-access";

/**
 * Условие выборки пространства для пользователя. Студенту закрытого потока из
 * уведомлений платформы остаются только ответы поддержки (A1): платформа ему
 * закрыта, а обращения открыты. 403 здесь не подходит — сайдбар и переключатель
 * запрашивают счётчики на каждой странице.
 */
async function spaceScope(userId: string, role: string | undefined) {
  const platformClosed = await isPlatformClosedForStudent(userId, role);
  return (space: NotificationSpace) =>
    space === "vkr" && platformClosed
      ? { AND: [spaceWhere("vkr"), SUPPORT_REPLY_WHERE] }
      : spaceWhere(space);
}

// GET /api/notifications — список уведомлений текущего пространства (08.22).
// Параметр space: "vkr" (по умолчанию) или "expert". Уведомления двух разделов
// не смешиваются; счётчик другого пространства нужен для бейджа переключателя.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const scope = await spaceScope(session.user.id, session.user.role);
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = Math.min(Number(searchParams.get("limit")) || 30, 100);
  const space = parseSpace(searchParams.get("space"));

  const where: Record<string, unknown> = {
    userId: session.user.id,
    ...scope(space),
  };
  if (unreadOnly) where.read = false;

  const [notifications, unreadCount, otherUnreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, read: false, ...scope(space) },
    }),
    prisma.notification.count({
      where: {
        userId: session.user.id,
        read: false,
        ...scope(otherSpace(space)),
      },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount, otherUnreadCount, space });
}

// PATCH /api/notifications — пометить уведомления как прочитанные
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const scope = await spaceScope(session.user.id, session.user.role);
  const body = await request.json();
  const { ids, all, space: spaceRaw } = body as {
    ids?: string[];
    all?: boolean;
    space?: string;
  };
  const space = parseSpace(spaceRaw);

  if (all) {
    // «Прочитать все» действует только на текущее пространство (08.22)
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false, ...scope(space) },
      data: { read: true },
    });
  } else if (ids && ids.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: session.user.id },
      data: { read: true },
    });
  }

  const [unreadCount, otherUnreadCount] = await Promise.all([
    prisma.notification.count({
      where: { userId: session.user.id, read: false, ...scope(space) },
    }),
    prisma.notification.count({
      where: {
        userId: session.user.id,
        read: false,
        ...scope(otherSpace(space)),
      },
    }),
  ]);

  return NextResponse.json({ ok: true, unreadCount, otherUnreadCount });
}
