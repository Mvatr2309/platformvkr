import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
              direction: true,
              course: true,
              contact: true,
              user: { select: { name: true } },
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
  const project = await prisma.project.findUnique({
    where: { id },
    include: { supervisor: { select: { userId: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  // Проверка прав: свой проект (НР) или админ
  const isOwner = project.supervisor?.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Нет прав на редактирование" }, { status: 403 });
  }

  try {
    const data = await request.json();
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
