import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isGuardError } from "@/lib/api-guard";

// PATCH /api/events/[id] — редактирование события (только админ)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { id } = await params;

  const existing = await prisma.event.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });
  }

  const body = await request.json();
  const { title, description, date, endDate, eventType, direction, projectId } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description || null;
  if (date !== undefined) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }
    data.date = d;
  }
  if (endDate !== undefined) {
    if (endDate) {
      const d = new Date(endDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Некорректная дата окончания" }, { status: 400 });
      }
      data.endDate = d;
    } else {
      data.endDate = null;
    }
  }
  if (eventType !== undefined) data.eventType = eventType;
  if (direction !== undefined) data.direction = direction || null;
  if (projectId !== undefined) data.projectId = projectId || null;

  const event = await prisma.event.update({ where: { id }, data });
  revalidatePath("/calendar");
  return NextResponse.json(event);
}

// DELETE /api/events/[id] — удаление события (только админ)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { id } = await params;

  const existing = await prisma.event.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });
  }

  await prisma.event.delete({ where: { id } });
  revalidatePath("/calendar");
  return NextResponse.json({ ok: true });
}
