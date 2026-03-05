import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { notify } from "@/lib/notify";

// PUT /api/applications/[id] — принять или отклонить заявку (05.02)
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
      project: { select: { id: true, title: true, supervisorId: true } },
      student: {
        select: {
          id: true,
          userId: true,
          user: { select: { name: true, email: true } },
        },
      },
      supervisor: { select: { userId: true } },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }

  // Проверка прав: НР проекта или админ
  const isOwner = application.supervisor?.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const newStatus = action === "accept" ? "ACCEPTED" : "REJECTED";

  const updated = await prisma.application.update({
    where: { id },
    data: { status: newStatus, comment: comment || null },
  });

  // При принятии — добавляем студента в участники проекта
  if (action === "accept") {
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
  }

  // In-app уведомление студенту
  notify({
    userId: application.student.userId,
    type: action === "accept" ? "APPLICATION_ACCEPTED" : "APPLICATION_REJECTED",
    title: action === "accept" ? "Заявка принята" : "Заявка отклонена",
    message: action === "accept"
      ? `Ваша заявка на проект «${application.project.title}» принята. Вы в команде!`
      : `Ваша заявка на проект «${application.project.title}» отклонена.${comment ? ` Комментарий: ${comment}` : ""}`,
    link: `/projects/${application.project.id}`,
  }).catch(() => {});

  // 05.05 — уведомление о смене статуса
  try {
    const isAccepted = action === "accept";
    await sendMail({
      to: application.student.user.email,
      subject: isAccepted
        ? `Заявка принята — ${application.project.title}`
        : `Заявка отклонена — ${application.project.title}`,
      html: `
        <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #003092;">${isAccepted ? "Ваша заявка принята!" : "Заявка отклонена"}</h2>
          <p style="color: #333; font-size: 15px;">
            Уважаемый(ая) <strong>${application.student.user.name}</strong>,
          </p>
          <p style="color: #555; font-size: 15px;">
            ${isAccepted
              ? `Ваша заявка на проект «${application.project.title}» принята. Вы добавлены в команду.`
              : `Ваша заявка на проект «${application.project.title}» отклонена.${comment ? ` Комментарий: ${comment}` : ""}`
            }
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
  } catch {
    // Email не критичен
  }

  return NextResponse.json(updated);
}
