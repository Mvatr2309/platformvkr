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

  // Фильтр по месяцу — учитываем многодневные события (endDate)
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    where.AND = [
      { date: { lt: end } },
      { OR: [{ endDate: null, date: { gte: start } }, { endDate: { gte: start } }] },
    ];
  } else if (year) {
    const y = Number(year);
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);
    where.AND = [
      { date: { lt: end } },
      { OR: [{ endDate: null, date: { gte: start } }, { endDate: { gte: start } }] },
    ];
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

  // Только админ может создавать события
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, date, endDate, eventType, direction, projectId } = body;

  if (!title || !date || !eventType) {
    return NextResponse.json(
      { error: "Заполните название, дату и тип события" },
      { status: 400 }
    );
  }

  const startDt = new Date(date);
  const endDt = endDate ? new Date(endDate) : null;
  if (endDt && endDt < startDt) {
    return NextResponse.json(
      { error: "Дата окончания не может быть раньше даты начала" },
      { status: 400 }
    );
  }

  const event = await prisma.event.create({
    data: {
      title,
      description: description || null,
      date: startDt,
      endDate: endDt,
      eventType,
      direction: direction || null,
      projectId: projectId || null,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
