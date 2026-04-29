import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendMail } from "@/lib/mail";

// PUT /api/admin/projects/[id] — одобрить или отклонить проект
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const { action, comment } = await request.json();

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      supervisor: { select: { userId: true, user: { select: { name: true, email: true } } } },
      members: { select: { student: { select: { userId: true, user: { select: { email: true } } } } } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const newStatus = action === "approve" ? "OPEN" : "DRAFT";

  const updated = await prisma.project.update({
    where: { id },
    data: { status: newStatus },
  });

  // Запись в активность
  await prisma.activity.create({
    data: {
      projectId: id,
      action: action === "approve"
        ? "Проект одобрен модератором и открыт"
        : `Проект отклонён модератором${comment ? `: ${comment}` : ""}`,
      actorEmail: session.user.email,
    },
  });

  // Уведомление НР (если есть)
  if (project.supervisor) {
    notify({
      userId: project.supervisor.userId,
      type: "PROJECT_STATUS",
      title: action === "approve" ? "Проект одобрен" : "Проект отклонён",
      message: action === "approve"
        ? `Проект «${project.title}» одобрен и открыт для заявок.`
        : `Проект «${project.title}» отклонён.${comment ? ` Комментарий: ${comment}` : ""} Отредактируйте и отправьте повторно.`,
      link: `/projects/${id}`,
    }).catch(() => {});
  }

  // Уведомление участникам проекта (студентам-авторам)
  for (const member of project.members) {
    if (!member.student) continue; // ручные участники без аккаунта
    notify({
      userId: member.student.userId,
      type: "PROJECT_STATUS",
      title: action === "approve" ? "Проект одобрен" : "Проект отклонён",
      message: action === "approve"
        ? `Проект «${project.title}» одобрен и открыт для заявок.`
        : `Проект «${project.title}» отклонён.${comment ? ` Комментарий: ${comment}` : ""} Отредактируйте и отправьте повторно.`,
      link: `/projects/${id}`,
    }).catch(() => {});
  }

  // Email-уведомления (НР + авторы команды)
  const platformUrl = process.env.NEXTAUTH_URL || "https://vkr-platform.ru";
  const recipients = new Set<string>();
  if (project.supervisor?.user?.email) recipients.add(project.supervisor.user.email);
  for (const m of project.members) {
    if (m.student?.user?.email) recipients.add(m.student.user.email);
  }
  const subject = action === "approve"
    ? `Проект одобрен — ${project.title}`
    : `Проект отклонён — ${project.title}`;
  const html = action === "approve"
    ? `<div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #003092;">Проект одобрен</h2>
        <p>Проект «<strong>${project.title}</strong>» одобрен модератором и открыт для заявок.</p>
        <p><a href="${platformUrl}/projects/${id}" style="display: inline-block; background: #E8375A; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: 600;">Открыть проект</a></p>
      </div>`
    : `<div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #003092;">Проект отклонён</h2>
        <p>Проект «<strong>${project.title}</strong>» отклонён модератором.</p>
        ${comment ? `<p><strong>Комментарий:</strong> ${comment}</p>` : ""}
        <p>Отредактируйте проект и отправьте повторно.</p>
        <p><a href="${platformUrl}/projects/${id}" style="display: inline-block; background: #E8375A; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: 600;">Открыть проект</a></p>
      </div>`;
  for (const email of recipients) {
    sendMail({ to: email, subject, html }).catch((err) => {
      console.error("Failed to send moderation email to", email, ":", err.message);
    });
  }

  return NextResponse.json(updated);
}
