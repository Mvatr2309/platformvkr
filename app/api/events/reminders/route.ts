import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

// POST /api/events/reminders — отправить напоминания о приближающихся дедлайнах (06.04)
// Вызывается по расписанию (cron) или вручную админом.
// Параметр daysAhead — за сколько дней напоминать (по умолчанию 3).
export async function POST(request: NextRequest) {
  // Простая защита: секрет или админ-сессия
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET && secret !== "admin") {
    // Также проверим сессию
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const daysAhead = body.daysAhead || 3;

  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysAhead);

  // Начало и конец целевого дня
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Найти дедлайны на целевую дату
  const events = await prisma.event.findMany({
    where: {
      eventType: "DEADLINE",
      date: { gte: dayStart, lt: dayEnd },
    },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          supervisor: {
            select: { user: { select: { email: true, name: true } } },
          },
          members: {
            select: {
              student: { select: { user: { select: { email: true, name: true } } } },
            },
          },
        },
      },
    },
  });

  let sent = 0;

  for (const event of events) {
    // Собираем получателей: НР + студенты проекта
    const recipients: string[] = [];

    if (event.project) {
      if (event.project.supervisor?.user?.email) {
        recipients.push(event.project.supervisor.user.email);
      }
      for (const m of event.project.members) {
        if (m.student.user.email) {
          recipients.push(m.student.user.email);
        }
      }
    }

    // Если событие не привязано к проекту — пропускаем (общие дедлайны)
    // Для общих дедлайнов можно расширить логику позже

    const dateStr = new Date(event.date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    for (const email of recipients) {
      try {
        await sendMail({
          to: email,
          subject: `Напоминание: ${event.title} — ${dateStr}`,
          html: `
            <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #003092;">Напоминание о дедлайне</h2>
              <p style="color: #333; font-size: 15px;">
                Через <strong>${daysAhead} дн.</strong> наступает дедлайн:
              </p>
              <p style="color: #E8375A; font-size: 18px; font-weight: 600;">${event.title}</p>
              <p style="color: #555;">${dateStr}</p>
              ${event.project ? `
                <p>
                  <a href="${process.env.NEXTAUTH_URL}/projects/${event.project.id}"
                     style="display: inline-block; background: #E8375A; color: #fff; padding: 14px 28px; text-decoration: none; font-weight: 600;">
                    Перейти к проекту
                  </a>
                </p>
              ` : ""}
            </div>
          `,
        });
        sent++;
      } catch {
        // Продолжаем при ошибке отправки
      }
    }
  }

  return NextResponse.json({
    message: `Отправлено ${sent} напоминаний для ${events.length} дедлайнов`,
    eventsFound: events.length,
    emailsSent: sent,
  });
}
