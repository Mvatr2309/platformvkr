import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendMail } from "@/lib/mail";

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

  // Если появился новый/обновлённый ответ — уведомить пользователя
  if (isNewResponse && existing.user) {
    notify({
      userId: existing.user.id,
      type: "SYSTEM",
      title: "Получен ответ на ваше обращение",
      message: `Команда разработки ответила на ваше обращение от ${existing.createdAt.toLocaleDateString("ru-RU")}`,
      link: "/inquiries",
    }).catch(() => {});

    if (existing.user.email) {
      const platformUrl = process.env.NEXTAUTH_URL || "https://vkr-platform.ru";
      sendMail({
        to: existing.user.email,
        subject: "Ответ на ваше обращение — Платформа ВКР",
        html: `<div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #003092;">Получен ответ на ваше обращение</h2>
          <p><strong>Ваш вопрос:</strong></p>
          <div style="background: #f6f6f6; padding: 12px 16px; margin: 8px 0;">${existing.message.replace(/\n/g, "<br>")}</div>
          <p><strong>Ответ команды разработки:</strong></p>
          <div style="background: #f0f4ff; padding: 12px 16px; margin: 8px 0;">${trimmedResponse.replace(/\n/g, "<br>")}</div>
          <p><a href="${platformUrl}/inquiries" style="display: inline-block; background: #E8375A; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: 600;">Открыть мои обращения</a></p>
        </div>`,
      }).catch((err) => console.error("Failed to send feedback response email:", err.message));
    }
  }

  return NextResponse.json(updated);
}
