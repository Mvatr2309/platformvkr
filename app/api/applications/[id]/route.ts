import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { notify } from "@/lib/notify";

// PUT /api/applications/[id] — двухэтапная модерация заявки
// Этап 1: Автор проекта (или НР) → accept/reject (PENDING → APPROVED_BY_AUTHOR / REJECTED)
// Этап 2: Админ → approve/reject (APPROVED_BY_AUTHOR → ACCEPTED / REJECTED)
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

  if (!["accept", "reject", "approve"].includes(action)) {
    return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
  }

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          supervisorId: true,
          supervisor: { select: { userId: true } },
          members: { select: { role: true, student: { select: { userId: true } } } },
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

  const isAdmin = session.user.role === "ADMIN";
  const isSupervisorOwner = application.project.supervisor?.userId === session.user.id;
  const isProjectAuthor = application.project.members.some(
    (m) => m.role === "Автор" && m.student.userId === session.user.id
  );
  const canReview = isAdmin || isSupervisorOwner || isProjectAuthor;

  if (!canReview) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  // Этап 1: Автор/НР принимает или отклоняет (PENDING → APPROVED_BY_AUTHOR / REJECTED)
  if (action === "accept") {
    if (application.status !== "PENDING") {
      return NextResponse.json({ error: "Заявка уже рассмотрена" }, { status: 400 });
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status: "APPROVED_BY_AUTHOR", comment: comment || null },
    });

    // Уведомление студенту
    notify({
      userId: application.student.userId,
      type: "APPLICATION_ACCEPTED",
      title: "Заявка одобрена автором",
      message: `Ваша заявка на проект «${application.project.title}» одобрена автором и отправлена на модерацию администратору.`,
      link: `/projects/${application.project.id}`,
    }).catch(() => {});

    // Уведомление всем админам
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    for (const admin of admins) {
      notify({
        userId: admin.id,
        type: "APPLICATION_NEW",
        title: "Заявка на модерацию",
        message: `Автор проекта «${application.project.title}» одобрил заявку студента ${application.student.user.name}. Требуется модерация.`,
        link: `/admin/applications`,
      }).catch(() => {});
    }

    return NextResponse.json(updated);
  }

  // Этап 2: Админ одобряет (APPROVED_BY_AUTHOR → ACCEPTED)
  if (action === "approve") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Только админ может финально одобрить заявку" }, { status: 403 });
    }
    if (application.status !== "APPROVED_BY_AUTHOR") {
      return NextResponse.json({ error: "Заявка не одобрена автором" }, { status: 400 });
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
      message: `Ваша заявка на проект «${application.project.title}» принята администратором. Вы в команде!`,
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

  // Отклонение (на любом этапе: автором или админом)
  if (action === "reject") {
    if (application.status !== "PENDING" && application.status !== "APPROVED_BY_AUTHOR") {
      return NextResponse.json({ error: "Заявка уже рассмотрена" }, { status: 400 });
    }

    // Автор/НР может отклонить только PENDING, админ — и APPROVED_BY_AUTHOR
    if (application.status === "APPROVED_BY_AUTHOR" && !isAdmin) {
      return NextResponse.json({ error: "Только админ может отклонить одобренную заявку" }, { status: 403 });
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status: "REJECTED", comment: comment || null },
    });

    // Уведомление студенту
    notify({
      userId: application.student.userId,
      type: "APPLICATION_REJECTED",
      title: "Заявка отклонена",
      message: `Ваша заявка на проект «${application.project.title}» отклонена.${comment ? ` Комментарий: ${comment}` : ""}`,
      link: `/projects/${application.project.id}`,
    }).catch(() => {});

    // Email
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
