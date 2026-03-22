import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/events/[id] — редактирование события (только админ)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, description, date, eventType, direction, projectId } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description || null;
  if (date !== undefined) data.date = new Date(date);
  if (eventType !== undefined) data.eventType = eventType;
  if (direction !== undefined) data.direction = direction || null;
  if (projectId !== undefined) data.projectId = projectId || null;

  const event = await prisma.event.update({
    where: { id },
    data,
  });

  return NextResponse.json(event);
}

// DELETE /api/events/[id] — удаление события (только админ)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.event.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
