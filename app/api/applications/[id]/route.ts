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

  if (!["accept", "reject", "interested", "confirm", "decline"].includes(action)) {
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
          contact: true,
          user: { select: { name: true, email: true } },
        },
      },
      supervisor: {
        select: {
          id: true,
          userId: true,
          contact: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }

  // Проверка прав: автор проекта, НР проекта или админ
  const isAdmin = session.user.role === "ADMIN";
  const isSupervisorOwner = application.project.supervisor?.userId === session.user.id;
  const isTargetSupervisor = application.supervisor?.userId === session.user.id;
  const isProjectCreator = application.project.members.some(
    (m) => m.isCreator && m.student.userId === session.user.id
  );

  // ===== SUPERVISION_REQUEST — предложение проекта от студента НР =====
  if (application.type === "SUPERVISION_REQUEST") {
    // НР может: interested, confirm, decline, reject
    // Админ/Автор может: reject
    const canReviewSR = isTargetSupervisor || isAdmin || isProjectCreator;
    if (!canReviewSR) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }

    // НР заинтересован — контакты раскрываются
    if (action === "interested" && isTargetSupervisor) {
      if (application.status !== "PENDING") {
        return NextResponse.json({ error: "Заявка уже рассмотрена" }, { status: 400 });
      }

      const updated = await prisma.application.update({
        where: { id },
        data: { status: "INTERESTED" },
      });

      await prisma.activity.create({
        data: {
          projectId: application.project.id,
          action: `НР ${application.supervisor!.user.name} заинтересован в руководстве`,
          actorEmail: session.user.email,
        },
      });

      // Уведомление студенту — НР заинтересован, контакты раскрыты
      notify({
        userId: application.student!.userId,
        type: "APPLICATION_ACCEPTED",
        title: "НР заинтересован в вашем проекте",
        message: `${application.supervisor!.user.name} заинтересован в руководстве проектом «${application.project.title}». Свяжитесь для встречи! Контакт: ${application.supervisor!.contact}`,
        link: `/applications`,
      }).catch(() => {});

      // Уведомление НР — контакт студента
      notify({
        userId: application.supervisor!.userId,
        type: "APPLICATION_ACCEPTED",
        title: "Контакт студента",
        message: `Контакт студента ${application.student!.user.name}: ${application.student!.contact}. Договоритесь о встрече для обсуждения проекта «${application.project.title}».`,
        link: `/applications`,
      }).catch(() => {});

      return NextResponse.json(updated);
    }

    // НР подтверждает руководство после встречи
    if (action === "confirm" && isTargetSupervisor) {
      if (application.status !== "INTERESTED") {
        return NextResponse.json({ error: "Сначала отметьте заинтересованность" }, { status: 400 });
      }

      await prisma.application.update({
        where: { id },
        data: { status: "CONFIRMED" },
      });

      await prisma.project.update({
        where: { id: application.project.id },
        data: {
          supervisorId: application.supervisor!.id,
          assignmentStatus: "CONFIRMED",
        },
      });

      // Отклонить другие предложения на этот проект
      await prisma.application.updateMany({
        where: {
          projectId: application.project.id,
          type: { in: ["SUPERVISION_REQUEST", "SUPERVISOR"] },
          id: { not: id },
          status: { in: ["PENDING", "INTERESTED"] },
        },
        data: { status: "DECLINED", comment: "Другой научный руководитель подтвердил руководство" },
      });

      await prisma.activity.create({
        data: {
          projectId: application.project.id,
          action: `НР ${application.supervisor!.user.name} подтвердил руководство проектом`,
          actorEmail: session.user.email,
        },
      });

      notify({
        userId: application.student!.userId,
        type: "APPLICATION_ACCEPTED",
        title: "НР подтвердил руководство!",
        message: `${application.supervisor!.user.name} подтвердил руководство проектом «${application.project.title}»!`,
        link: `/projects/${application.project.id}`,
      }).catch(() => {});

      try {
        await sendMail({
          to: application.student!.user.email,
          subject: `НР подтвердил руководство — ${application.project.title}`,
          html: `
            <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #003092;">Научный руководитель подтверждён!</h2>
              <p style="color: #555; font-size: 15px;">
                ${application.supervisor!.user.name} подтвердил руководство проектом «${application.project.title}».
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
      } catch { /* ignore */ }

      return NextResponse.json({ status: "CONFIRMED" });
    }

    // НР отказывается после встречи
    if (action === "decline" && isTargetSupervisor) {
      if (!["PENDING", "INTERESTED"].includes(application.status)) {
        return NextResponse.json({ error: "Заявка уже рассмотрена" }, { status: 400 });
      }

      const updated = await prisma.application.update({
        where: { id },
        data: { status: "DECLINED", comment: comment || null },
      });

      await prisma.activity.create({
        data: {
          projectId: application.project.id,
          action: `НР ${application.supervisor!.user.name} отклонил предложение руководства`,
          actorEmail: session.user.email,
        },
      });

      notify({
        userId: application.student!.userId,
        type: "APPLICATION_REJECTED",
        title: "НР отклонил предложение",
        message: `${application.supervisor!.user.name} отклонил предложение руководства проектом «${application.project.title}».${comment ? ` Причина: ${comment}` : ""}`,
        link: `/applications`,
      }).catch(() => {});

      return NextResponse.json(updated);
    }

    // Отклонение (reject) — автором или админом
    if (action === "reject") {
      if (!["PENDING"].includes(application.status)) {
        return NextResponse.json({ error: "Заявка уже рассмотрена" }, { status: 400 });
      }

      const updated = await prisma.application.update({
        where: { id },
        data: { status: "REJECTED", comment: comment || null },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Недопустимое действие для этого типа заявки" }, { status: 400 });
  }

  const canReview = isAdmin || isSupervisorOwner || isProjectCreator;

  if (!canReview) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  if (application.status !== "PENDING") {
    return NextResponse.json({ error: "Заявка уже рассмотрена" }, { status: 400 });
  }

  // ===== Заявка от НР (type: SUPERVISOR) =====
  if (application.type === "SUPERVISOR") {
    if (action === "accept") {
      // Назначаем НР на проект
      await prisma.application.update({
        where: { id },
        data: { status: "ACCEPTED", comment: comment || null },
      });

      await prisma.project.update({
        where: { id: application.project.id },
        data: {
          supervisorId: application.supervisor!.id,
          assignmentStatus: "CONFIRMED",
        },
      });

      // Отклоняем другие заявки НР на этот проект
      await prisma.application.updateMany({
        where: {
          projectId: application.project.id,
          type: "SUPERVISOR",
          id: { not: id },
          status: "PENDING",
        },
        data: { status: "REJECTED", comment: "Другой научный руководитель был выбран" },
      });

      await prisma.activity.create({
        data: {
          projectId: application.project.id,
          action: `Научный руководитель ${application.supervisor!.user.name} назначен на проект`,
          actorEmail: session.user.email,
        },
      });

      // Уведомление НР
      notify({
        userId: application.supervisor!.userId,
        type: "APPLICATION_ACCEPTED",
        title: "Заявка на руководство принята",
        message: `Ваша заявка на руководство проектом «${application.project.title}» принята!`,
        link: `/projects/${application.project.id}`,
      }).catch(() => {});

      // Email НР
      try {
        await sendMail({
          to: application.supervisor!.user.email,
          subject: `Заявка принята — ${application.project.title}`,
          html: `
            <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #003092;">Ваша заявка на руководство принята!</h2>
              <p style="color: #333; font-size: 15px;">
                Уважаемый(ая) <strong>${application.supervisor!.user.name}</strong>,
              </p>
              <p style="color: #555; font-size: 15px;">
                Вы назначены научным руководителем проекта «${application.project.title}».
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

      return NextResponse.json({ status: "ACCEPTED" });
    }

    if (action === "reject") {
      const updated = await prisma.application.update({
        where: { id },
        data: { status: "REJECTED", comment: comment || null },
      });

      notify({
        userId: application.supervisor!.userId,
        type: "APPLICATION_REJECTED",
        title: "Заявка на руководство отклонена",
        message: `Ваша заявка на руководство проектом «${application.project.title}» отклонена.${comment ? ` Комментарий: ${comment}` : ""}`,
        link: `/projects/${application.project.id}`,
      }).catch(() => {});

      try {
        await sendMail({
          to: application.supervisor!.user.email,
          subject: `Заявка отклонена — ${application.project.title}`,
          html: `
            <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #003092;">Заявка на руководство отклонена</h2>
              <p style="color: #333; font-size: 15px;">
                Уважаемый(ая) <strong>${application.supervisor!.user.name}</strong>,
              </p>
              <p style="color: #555; font-size: 15px;">
                Ваша заявка на руководство проектом «${application.project.title}» отклонена.${comment ? ` Комментарий: ${comment}` : ""}
              </p>
            </div>
          `,
        });
      } catch { /* Email не критичен */ }

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
  }

  // ===== Заявка от студента (type: STUDENT) =====
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
        studentId: application.student!.id,
        role: application.role || null,
      },
    });

    await prisma.activity.create({
      data: {
        projectId: application.project.id,
        action: `Студент ${application.student!.user.name} принят в команду`,
        actorEmail: session.user.email,
      },
    });

    // Уведомление студенту
    notify({
      userId: application.student!.userId,
      type: "APPLICATION_ACCEPTED",
      title: "Заявка принята",
      message: `Ваша заявка на проект «${application.project.title}» принята. Вы в команде!`,
      link: `/projects/${application.project.id}`,
    }).catch(() => {});

    // Email студенту
    try {
      await sendMail({
        to: application.student!.user.email,
        subject: `Заявка принята — ${application.project.title}`,
        html: `
          <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #003092;">Ваша заявка принята!</h2>
            <p style="color: #333; font-size: 15px;">
              Уважаемый(ая) <strong>${application.student!.user.name}</strong>,
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
      userId: application.student!.userId,
      type: "APPLICATION_REJECTED",
      title: "Заявка отклонена",
      message: `Ваша заявка на проект «${application.project.title}» отклонена.${comment ? ` Комментарий: ${comment}` : ""}`,
      link: `/projects/${application.project.id}`,
    }).catch(() => {});

    try {
      await sendMail({
        to: application.student!.user.email,
        subject: `Заявка отклонена — ${application.project.title}`,
        html: `
          <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #003092;">Заявка отклонена</h2>
            <p style="color: #333; font-size: 15px;">
              Уважаемый(ая) <strong>${application.student!.user.name}</strong>,
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
