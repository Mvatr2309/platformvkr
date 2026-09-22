import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { safeMail } from "@/lib/expert-requests";

// POST /api/expert/jobs/feedback — отложенные задачи экспертной трубы (08.16, 08.17, 08.20).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 9)
//
// Вызывается по расписанию раз в сутки. Паттерн повторяет существующий
// app/api/events/reminders/route.ts: защита секретом, идемпотентность по отметкам
// времени. Пропуск дня не ломает логику — джоба догонит накопившееся.
//
// Таймлайн: контакты → +7 дней форма → +3 дня напоминание → +7 дней от формы
// авто-закрытие. У студента есть 4 дня после напоминания.

const DAYS_TO_FEEDBACK = 7;
const DAYS_TO_REMINDER = 3;
const DAYS_TO_AUTOCLOSE = 7;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const platformUrl = () => process.env.NEXTAUTH_URL || "https://vkr-platform.ru";

function feedbackMail(who: "student" | "expert", otherName: string, link: string) {
  const intro =
    who === "student"
      ? `Неделю назад вы получили контакты эксперта <strong>${otherName}</strong>.`
      : `Неделю назад вы приняли запрос студента <strong>${otherName}</strong>.`;
  return `
    <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #003092; margin-bottom: 16px;">Как прошла консультация?</h2>
      <p style="color:#333;font-size:15px;">${intro}</p>
      <p style="color:#555;font-size:14px;">Ответьте на один вопрос — состоялась ли встреча. Это займёт меньше минуты и поможет нам понимать, работает ли раздел.</p>
      <p style="margin-top:24px;">
        <a href="${platformUrl()}${link}" style="display:inline-block;background:#E8375A;color:#fff;padding:12px 24px;text-decoration:none;font-weight:600;">
          Оставить обратную связь
        </a>
      </p>
    </div>
  `;
}

export async function POST(request: NextRequest) {
  // Защита: секрет из окружения или админская сессия
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }
  }

  const now = new Date();
  const result = { feedbackRequested: 0, remindersSent: 0, autoClosed: 0 };

  // --- Проход 1: через 7 дней после отправки контактов запрашиваем обратную связь ---
  const toAsk = await prisma.expertRequest.findMany({
    where: {
      status: "CONTACTS_SENT",
      contactsSentAt: { lte: daysAgo(DAYS_TO_FEEDBACK) },
    },
    select: {
      id: true,
      student: { select: { userId: true, user: { select: { email: true, name: true } } } },
      expert: { select: { userId: true, user: { select: { email: true, name: true } } } },
    },
  });

  for (const r of toAsk) {
    await prisma.expertRequest.update({
      where: { id: r.id },
      data: { status: "AWAITING_FEEDBACK", feedbackRequestedAt: now },
    });

    await notify({
      userId: r.student.userId,
      type: "EXPERT_FEEDBACK_REQUEST",
      title: "Как прошла консультация?",
      message: `Расскажите, состоялась ли встреча с экспертом ${r.expert.user.name}.`,
      link: "/expert/my-requests",
    });
    await safeMail(
      r.student.user.email,
      "Как прошла консультация?",
      feedbackMail("student", r.expert.user.name || "эксперт", "/expert/my-requests")
    );

    await notify({
      userId: r.expert.userId,
      type: "EXPERT_FEEDBACK_REQUEST",
      title: "Как прошла консультация?",
      message: `Расскажите, состоялась ли встреча со студентом ${r.student.user.name}.`,
      link: "/expert/inbox",
    });
    await safeMail(
      r.expert.user.email,
      "Как прошла консультация?",
      feedbackMail("expert", r.student.user.name || "студент", "/expert/inbox")
    );

    result.feedbackRequested++;
  }

  // --- Проход 2: одно напоминание студенту через 3 дня, если он не ответил (08.17) ---
  const toRemind = await prisma.expertRequest.findMany({
    where: {
      status: "AWAITING_FEEDBACK",
      feedbackRequestedAt: { lte: daysAgo(DAYS_TO_REMINDER) },
      feedbackReminderSentAt: null,
      feedbacks: { none: { authorSide: "STUDENT" } },
    },
    select: {
      id: true,
      student: { select: { userId: true, user: { select: { email: true, name: true } } } },
      expert: { select: { user: { select: { name: true } } } },
    },
  });

  for (const r of toRemind) {
    await prisma.expertRequest.update({
      where: { id: r.id },
      data: { feedbackReminderSentAt: now },
    });
    await notify({
      userId: r.student.userId,
      type: "EXPERT_FEEDBACK_REQUEST",
      title: "Напоминание: как прошла консультация?",
      message: `Ответьте на один вопрос по встрече с экспертом ${r.expert.user.name}.`,
      link: "/expert/my-requests",
    });
    await safeMail(
      r.student.user.email,
      "Напоминание: как прошла консультация?",
      feedbackMail("student", r.expert.user.name || "эксперт", "/expert/my-requests")
    );
    result.remindersSent++;
  }

  // --- Проход 3: авто-закрытие через 7 дней от запроса обратной связи (08.20) ---
  // Уведомления не отправляем: это тихое закрытие, шум в почте ни к чему.
  const toClose = await prisma.expertRequest.findMany({
    where: {
      status: "AWAITING_FEEDBACK",
      feedbackRequestedAt: { lte: daysAgo(DAYS_TO_AUTOCLOSE) },
      feedbacks: { none: { authorSide: "STUDENT" } },
    },
    select: { id: true },
  });

  if (toClose.length > 0) {
    await prisma.expertRequest.updateMany({
      where: { id: { in: toClose.map((r) => r.id) } },
      data: { status: "CLOSED", closedAt: now, closedWithoutFeedback: true },
    });
    result.autoClosed = toClose.length;
  }

  return NextResponse.json({
    message: `Запрошено обратной связи: ${result.feedbackRequested}, напоминаний: ${result.remindersSent}, авто-закрыто: ${result.autoClosed}`,
    ...result,
  });
}
