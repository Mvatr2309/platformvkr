import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

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
      supervisor: { select: { userId: true, user: { select: { name: true } } } },
      members: { select: { student: { select: { userId: true } } } },
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

  return NextResponse.json(updated);
}
