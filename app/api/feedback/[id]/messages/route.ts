import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify, notifyMany } from "@/lib/notify";
import { sendMail } from "@/lib/mail";

// GET /api/feedback/[id]/messages — получить все сообщения треда
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  const fb = await prisma.feedback.findUnique({
    where: { id },
    select: { id: true, userId: true, message: true, response: true, respondedAt: true, createdAt: true },
  });
  if (!fb) {
    return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = fb.userId === session.user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const messages = await prisma.feedbackMessage.findMany({
    where: { feedbackId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
  });

  // Формируем виртуальные сообщения для исходного вопроса и старого ответа
  // (на случай, если они ещё не мигрированы в FeedbackMessage)
  const virtualMessages: Array<{
    id: string;
    authorRole: "USER" | "ADMIN";
    authorName: string | null;
    text: string;
    createdAt: string;
    virtual: boolean;
  }> = [];

  if (messages.length === 0) {
    // Тред пуст — синтезируем из старых полей
    virtualMessages.push({
      id: `init_${fb.id}`,
      authorRole: "USER",
      authorName: null,
      text: fb.message,
      createdAt: fb.createdAt.toISOString(),
      virtual: true,
    });
    if (fb.response && fb.respondedAt) {
      virtualMessages.push({
        id: `resp_${fb.id}`,
        authorRole: "ADMIN",
        authorName: null,
        text: fb.response,
        createdAt: fb.respondedAt.toISOString(),
        virtual: true,
      });
    }
  }

  const real = messages.map((m) => ({
    id: m.id,
    authorRole: (m.author.role === "ADMIN" ? "ADMIN" : "USER") as "USER" | "ADMIN",
    authorName: m.author.name,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    virtual: false,
  }));

  return NextResponse.json([...virtualMessages, ...real]);
}

// POST /api/feedback/[id]/messages — добавить сообщение в тред
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const { text } = await request.json();

  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Сообщение пустое" }, { status: 400 });
  }

  const fb = await prisma.feedback.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!fb) {
    return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = fb.userId === session.user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  // Если в треде ещё нет сообщений — мигрируем старые поля как первые сообщения
  const existingCount = await prisma.feedbackMessage.count({ where: { feedbackId: id } });
  if (existingCount === 0) {
    await prisma.feedbackMessage.create({
      data: { feedbackId: id, authorId: fb.userId, text: fb.message, createdAt: fb.createdAt },
    });
    if (fb.response && fb.respondedAt) {
      // Старый ответ был от какого-то админа — приписываем его текущему админу или первому найденному
      const someAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
      if (someAdmin) {
        await prisma.feedbackMessage.create({
          data: { feedbackId: id, authorId: someAdmin.id, text: fb.response, createdAt: fb.respondedAt },
        });
      }
    }
  }

  const message = await prisma.feedbackMessage.create({
    data: { feedbackId: id, authorId: session.user.id, text: trimmed },
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
  });

  // Статус-ауто:
  //  - админ отвечает на NEW → IN_PROGRESS
  //  - пользователь отвечает на RESOLVED → IN_PROGRESS (переоткрытие)
  let newStatus: "NEW" | "IN_PROGRESS" | "RESOLVED" | null = null;
  if (isAdmin && fb.status === "NEW") newStatus = "IN_PROGRESS";
  else if (!isAdmin && fb.status === "RESOLVED") newStatus = "IN_PROGRESS";
  if (newStatus) {
    await prisma.feedback.update({ where: { id }, data: { status: newStatus } });
  }

  const platformUrl = process.env.NEXTAUTH_URL || "https://vkr-platform.ru";

  if (isAdmin) {
    // Уведомить пользователя
    notify({
      userId: fb.userId,
      type: "SYSTEM",
      title: "Новое сообщение по обращению",
      message: `Команда разработки ответила: «${trimmed.slice(0, 100)}${trimmed.length > 100 ? "…" : ""}»`,
      link: "/inquiries",
    }).catch(() => {});

    if (fb.user.email) {
      sendMail({
        to: fb.user.email,
        subject: "Новое сообщение по обращению — Платформа ВКР",
        html: `<div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #003092;">Новое сообщение по обращению</h2>
          <p>Команда разработки ответила:</p>
          <div style="background: #f0f4ff; padding: 12px 16px; margin: 8px 0;">${trimmed.replace(/\n/g, "<br>")}</div>
          <p>Вы можете продолжить переписку, открыв обращение на платформе.</p>
          <p><a href="${platformUrl}/inquiries" style="display: inline-block; background: #E8375A; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: 600;">Открыть мои обращения</a></p>
        </div>`,
      }).catch((err) => console.error("Failed to send thread email:", err.message));
    }
  } else {
    // Пользователь ответил → уведомить всех админов
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    notifyMany(
      admins.map((a) => a.id),
      {
        type: "SYSTEM",
        title: "Новое сообщение в обращении",
        message: `${session.user.name || fb.user.email} ответил(а) в обращении: «${trimmed.slice(0, 100)}${trimmed.length > 100 ? "…" : ""}»`,
        link: "/admin/feedback",
      }
    ).catch(() => {});
  }

  return NextResponse.json({
    id: message.id,
    authorRole: (message.author.role === "ADMIN" ? "ADMIN" : "USER") as "USER" | "ADMIN",
    authorName: message.author.name,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    virtual: false,
  }, { status: 201 });
}
