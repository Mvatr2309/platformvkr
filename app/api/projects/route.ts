import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects — каталог проектов с фильтрами (02.05, 02.07)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const projectType = searchParams.get("projectType") || "";
  const direction = searchParams.get("direction") || "";
  const status = searchParams.get("status") || "";
  const supervisorId = searchParams.get("supervisorId") || "";
  const my = searchParams.get("my"); // "true" — только свои проекты

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  // По умолчанию показываем открытые, если не запрошены свои
  if (my !== "true") {
    where.status = status || "OPEN";
  }

  if (projectType) where.projectType = projectType;
  if (direction) where.direction = direction;
  if (supervisorId) where.supervisorId = supervisorId;

  // Свои проекты
  if (my === "true") {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (session.user.role === "SUPERVISOR") {
      const profile = await prisma.supervisorProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!profile) return NextResponse.json([]);
      where.supervisorId = profile.id;
    }
    if (session.user.role === "STUDENT") {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!profile) return NextResponse.json([]);
      where.members = { some: { studentId: profile.id } };
    }
    delete where.status; // Показываем все статусы для своих
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      supervisor: {
        select: { id: true, user: { select: { name: true } } },
      },
      _count: { select: { members: true, applications: true } },
    },
  });

  return NextResponse.json(projects);
}

// POST /api/projects — создание проекта (02.01)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  try {
    const data = await request.json();

    if (!data.title || !data.description || !data.projectType || !data.contact) {
      return NextResponse.json(
        { error: "Заполните обязательные поля" },
        { status: 400 }
      );
    }

    // Определяем supervisorId (02.02 — автопривязка)
    let supervisorId: string | null = null;
    if (session.user.role === "SUPERVISOR") {
      const profile = await prisma.supervisorProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      supervisorId = profile?.id || null;
    }

    const status = data.submit ? "PENDING" : "DRAFT";

    const project = await prisma.project.create({
      data: {
        title: data.title,
        description: data.description,
        projectType: data.projectType,
        direction: data.direction || null,
        requiredRoles: data.requiredRoles || [],
        contact: data.contact,
        supervisorId,
        status,
      },
    });

    // Автоматически добавляем создателя-студента как участника
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (studentProfile) {
        await prisma.projectMember.create({
          data: {
            projectId: project.id,
            studentId: studentProfile.id,
            role: data.authorRole || null,
            isCreator: true,
          },
        });
      }
    }

    // Прикрепляем файлы, если переданы
    if (data.files && Array.isArray(data.files)) {
      for (const file of data.files) {
        if (file.url && file.name) {
          await prisma.projectFile.create({
            data: {
              projectId: project.id,
              filename: file.name,
              filepath: file.url,
            },
          });
        }
      }
    }

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ошибка создания проекта" },
      { status: 500 }
    );
  }
}
