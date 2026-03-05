import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/events — список событий с фильтрами (06.02)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get("eventType");
  const direction = searchParams.get("direction");
  const projectId = searchParams.get("projectId");
  const month = searchParams.get("month"); // формат: 2026-03
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {};

  if (eventType) where.eventType = eventType;
  if (direction) where.direction = direction;
  if (projectId) where.projectId = projectId;

  // Фильтр по месяцу
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    where.date = { gte: start, lt: end };
  } else if (year) {
    const y = Number(year);
    where.date = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: "asc" },
    include: {
      project: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(events);
}

// POST /api/events — создание события (06.01)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Только админ или НР могут создавать события
  if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, date, eventType, direction, projectId } = body;

  if (!title || !date || !eventType) {
    return NextResponse.json(
      { error: "Заполните название, дату и тип события" },
      { status: 400 }
    );
  }

  // Если НР — проверяем, что проект принадлежит ему
  if (projectId && session.user.role === "SUPERVISOR") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { supervisor: { select: { userId: true } } },
    });
    if (!project || project.supervisor?.userId !== session.user.id) {
      return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
    }
  }

  const event = await prisma.event.create({
    data: {
      title,
      description: description || null,
      date: new Date(date),
      eventType,
      direction: direction || null,
      projectId: projectId || null,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
