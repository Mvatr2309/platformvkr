import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// PUT /api/projects/[id]/assignment — НР подтверждает или отклоняет назначение (04.03)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const { action } = await request.json();

  if (!["confirm", "decline"].includes(action)) {
    return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      supervisor: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  if (project.assignmentStatus !== "PENDING_SUPERVISOR") {
    return NextResponse.json({ error: "Нет ожидающего назначения" }, { status: 400 });
  }

  // Проверка: только назначенный НР может подтвердить/отклонить
  if (project.supervisor?.user.id !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  if (action === "confirm") {
    // Проверка лимита проектов НР
    const supProfile = await prisma.supervisorProfile.findUnique({
      where: { id: project.supervisor!.id },
      select: { maxProjects: true },
    });
    const supProjectCount = await prisma.project.count({
      where: { supervisorId: project.supervisor!.id },
    });
    // Текущий проект уже привязан к НР (supervisorId set), не считаем его повторно
    const otherProjects = supProjectCount - 1;
    if (otherProjects >= (supProfile?.maxProjects || 4)) {
      return NextResponse.json(
        { error: `Достигнут лимит проектов научного руководителя (${supProfile?.maxProjects || 4})` },
        { status: 400 }
      );
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { assignmentStatus: "CONFIRMED" },
    });

    await prisma.activity.create({
      data: {
        projectId: id,
        action: `Руководитель ${project.supervisor?.user.name} подтвердил назначение`,
        actorEmail: session.user.email,
      },
    });

    // Уведомляем админов
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const admin of admins) {
      notify({
        userId: admin.id,
        type: "PROJECT_STATUS",
        title: "Научный руководитель подтвердил назначение",
        message: `${project.supervisor?.user.name} подтвердил руководство проектом «${project.title}»`,
        link: `/admin/matching`,
      }).catch(() => {});
    }

    return NextResponse.json(updated);
  } else {
    // Отклонение — убираем НР с проекта
    const updated = await prisma.project.update({
      where: { id },
      data: {
        supervisorId: null,
        assignmentStatus: "DECLINED",
      },
    });

    await prisma.activity.create({
      data: {
        projectId: id,
        action: `Руководитель ${project.supervisor?.user.name} отклонил назначение`,
        actorEmail: session.user.email,
      },
    });

    // Уведомляем админов
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const admin of admins) {
      notify({
        userId: admin.id,
        type: "PROJECT_STATUS",
        title: "Научный руководитель отклонил назначение",
        message: `${project.supervisor?.user.name} отклонил руководство проектом «${project.title}»`,
        link: `/admin/matching`,
      }).catch(() => {});
    }

    return NextResponse.json(updated);
  }
}
