import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// PUT /api/feedback/[id] — обновить статус и/или ответить (только админ)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const { status, response } = await request.json();

  const data: Record<string, unknown> = {};

  if (status !== undefined) {
    if (!["NEW", "IN_PROGRESS", "RESOLVED"].includes(status)) {
      return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
    }
    data.status = status;
  }

  let isNewResponse = false;
  let trimmedResponse = "";
  if (response !== undefined) {
    trimmedResponse = String(response).trim();
    data.response = trimmedResponse || null;
    data.respondedAt = trimmedResponse ? new Date() : null;
    isNewResponse = !!trimmedResponse;
  }

  const existing = await prisma.feedback.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 });
  }

  const updated = await prisma.feedback.update({
    where: { id },
    data,
  });

  // Если появился новый/обновлённый ответ — уведомить пользователя (in-app)
  if (isNewResponse && existing.user) {
    notify({
      userId: existing.user.id,
      type: "SYSTEM",
      title: "Получен ответ на ваше обращение",
      message: `Команда разработки ответила на ваше обращение от ${existing.createdAt.toLocaleDateString("ru-RU")}`,
      link: "/inquiries",
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}
