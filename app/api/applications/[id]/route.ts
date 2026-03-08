import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { notify } from "@/lib/notify";

const STARTUP_TEAM_LIMIT = 4; // Максимум участников для стартапов (без НР)

// PUT /api/applications/[id] — принять или отклонить заявку
// Автор проекта, НР или админ принимает → студент сразу в команде
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const { action, comment } = await request.json();

  if (!["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
  }

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          projectType: true,
          supervisorId: true,
          supervisor: { select: { userId: true } },
          members: { select: { isCreator: true, student: { select: { userId: true } } } },
          _count: { select: { members: true } },
        },
      },
      student: {
        select: {
          id: true,
          userId: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }

  // Проверка прав: только автор (создатель) проекта или НР проекта
  const isSupervisorOwner = application.project.supervisor?.userId === session.user.id;
  const isProjectCreator = application.project.members.some(
    (m) => m.isCreator && m.student.userId === session.user.id
  );
  const canReview = isSupervisorOwner || isProjectCreator;

  if (!canReview) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  if (application.status !== "PENDING") {
    return NextResponse.json({ error: "Заявка уже рассмотрена" }, { status: 400 });
  }

  // Принятие — студент сразу в команде
  if (action === "accept") {
    // Проверка лимита команды для стартапов
    const isStartup = ["STARTUP", "CORPORATE_STARTUP"].includes(application.project.projectType);
    if (isStartup && application.project._count.members >= STARTUP_TEAM_LIMIT) {
      return NextResponse.json(
        { error: `В проектах типа «Стартап» максимум ${STARTUP_TEAM_LIMIT} участника в команде` },
        { status: 400 }
      );
    }
    const updated = await prisma.application.update({
      where: { id },
      data: { status: "ACCEPTED", comment: comment || null },
    });

    // Добавляем студента в участники проекта
    await prisma.projectMember.create({
      data: {
        projectId: application.project.id,
        studentId: application.student.id,
      },
    });

    await prisma.activity.create({
      data: {
        projectId: application.project.id,
        action: `Студент ${application.student.user.name} принят в команду`,
      },
    });

    // Уведомление студенту
    notify({
      userId: application.student.userId,
      type: "APPLICATION_ACCEPTED",
      title: "Заявка принята",
      message: `Ваша заявка на проект «${application.project.title}» принята. Вы в команде!`,
      link: `/projects/${application.project.id}`,
    }).catch(() => {});

    // Email студенту
    try {
      await sendMail({
        to: application.student.user.email,
        subject: `Заявка принята — ${application.project.title}`,
        html: `
          <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #003092;">Ваша заявка принята!</h2>
            <p style="color: #333; font-size: 15px;">
              Уважаемый(ая) <strong>${application.student.user.name}</strong>,
            </p>
            <p style="color: #555; font-size: 15px;">
              Ваша заявка на проект «${application.project.title}» принята. Вы добавлены в команду.
            </p>
            <p>
              <a href="${process.env.NEXTAUTH_URL}/projects/${application.project.id}"
                 style="display: inline-block; background: #E8375A; color: #fff; padding: 14px 28px; text-decoration: none; font-weight: 600;">
                Перейти к проекту
              </a>
            </p>
          </div>
        `,
      });
    } catch { /* Email не критичен */ }

    return NextResponse.json(updated);
  }

  // Отклонение
  if (action === "reject") {
    const updated = await prisma.application.update({
      where: { id },
      data: { status: "REJECTED", comment: comment || null },
    });

    notify({
      userId: application.student.userId,
      type: "APPLICATION_REJECTED",
      title: "Заявка отклонена",
      message: `Ваша заявка на проект «${application.project.title}» отклонена.${comment ? ` Комментарий: ${comment}` : ""}`,
      link: `/projects/${application.project.id}`,
    }).catch(() => {});

    try {
      await sendMail({
        to: application.student.user.email,
        subject: `Заявка отклонена — ${application.project.title}`,
        html: `
          <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #003092;">Заявка отклонена</h2>
            <p style="color: #333; font-size: 15px;">
              Уважаемый(ая) <strong>${application.student.user.name}</strong>,
            </p>
            <p style="color: #555; font-size: 15px;">
              Ваша заявка на проект «${application.project.title}» отклонена.${comment ? ` Комментарий: ${comment}` : ""}
            </p>
          </div>
        `,
      });
    } catch { /* Email не критичен */ }

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
}
