import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// GET /api/projects/[id] — детали проекта (02.06)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      supervisor: {
        select: {
          id: true,
          userId: true,
          workplace: true,
          position: true,
          academicDegree: true,
          photoUrl: true,
          user: { select: { name: true } },
        },
      },
      members: {
        include: {
          student: {
            select: {
              id: true,
              userId: true,
              direction: true,
              course: true,
              contact: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      },
      files: { orderBy: { uploadedAt: "desc" as const } },
      events: {
        select: { id: true, title: true, date: true, eventType: true },
        orderBy: { date: "asc" as const },
      },
      _count: { select: { applications: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  return NextResponse.json(project);
}

// Проверка прав на редактирование: только админ или автор проекта (isCreator)
async function checkEditAccess(projectId: string, userId: string, userRole: string) {
  if (userRole === "ADMIN") return true;

  const creator = await prisma.projectMember.findFirst({
    where: { projectId, isCreator: true, student: { userId } },
  });
  return !!creator;
}

// PUT /api/projects/[id] — редактирование проекта (02.04)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const hasAccess = await checkEditAccess(id, session.user.id, session.user.role as string);
  if (!hasAccess) {
    return NextResponse.json({ error: "Нет прав на редактирование" }, { status: 403 });
  }

  try {
    const data = await request.json();

    // Снятие НР с проекта (только админ)
    if (data.removeSupervisor) {
      if (session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Только админ может снять научного руководителя" }, { status: 403 });
      }
      const proj = await prisma.project.findUnique({
        where: { id },
        select: { title: true, supervisor: { select: { userId: true, user: { select: { name: true } } } } },
      });
      await prisma.project.update({
        where: { id },
        data: { supervisorId: null, assignmentStatus: "NONE" },
      });
      if (proj?.supervisor) {
        notify({
          userId: proj.supervisor.userId,
          type: "PROJECT_STATUS",
          title: "Вы сняты с проекта",
          message: `Администратор снял вас с руководства проектом «${proj.title}»`,
          link: `/my-projects`,
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    // НР покидает проект сам
    if (data.leaveSupervisor) {
      const proj = await prisma.project.findUnique({
        where: { id },
        select: {
          title: true,
          supervisor: { select: { userId: true, user: { select: { name: true } } } },
          members: { where: { isCreator: true }, select: { student: { select: { userId: true } } } },
        },
      });
      if (!proj?.supervisor || proj.supervisor.userId !== session.user.id) {
        return NextResponse.json({ error: "Вы не являетесь руководителем этого проекта" }, { status: 403 });
      }
      await prisma.project.update({
        where: { id },
        data: { supervisorId: null, assignmentStatus: "NONE" },
      });
      await prisma.activity.create({
        data: {
          projectId: id,
          action: `${proj.supervisor.user.name || "Научный руководитель"} покинул проект`,
          actorEmail: session.user.email,
        },
      });
      // Уведомление автору проекта
      const creator = proj.members[0];
      if (creator?.student) {
        notify({
          userId: creator.student.userId,
          type: "PROJECT_STATUS",
          title: "Научный руководитель покинул проект",
          message: `${proj.supervisor.user.name || "Научный руководитель"} покинул проект «${proj.title}»`,
          link: `/projects/${id}`,
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    const status = data.submit ? "PENDING" : (data.status || project.status);

    const updated = await prisma.project.update({
      where: { id },
      data: {
        title: data.title ?? project.title,
        description: data.description ?? project.description,
        projectType: data.projectType ?? project.projectType,
        direction: data.direction ?? project.direction,
        requiredRoles: data.requiredRoles ?? project.requiredRoles,
        contact: data.contact ?? project.contact,
        status,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Ошибка обновления проекта" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] — удаление проекта
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: { select: { id: true, isCreator: true, student: { select: { userId: true } } } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isAuthor = project.members.some(
    (m) => m.isCreator && m.student?.userId === session.user.id
  );

  if (!isAdmin && !isAuthor) {
    return NextResponse.json({ error: "Нет прав на удаление" }, { status: 403 });
  }

  // Автор может удалить только если нет других участников
  if (isAuthor && !isAdmin) {
    const otherMembers = project.members.filter((m) => !m.isCreator);
    if (otherMembers.length > 0) {
      return NextResponse.json(
        { error: "Нельзя удалить проект с участниками. Сначала удалите участников." },
        { status: 400 }
      );
    }
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
