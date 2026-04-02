import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/projects/[id]/manual-members — добавить участника вручную
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const { name, email, direction, role } = await request.json();

  if (!name || !email) {
    return NextResponse.json({ error: "ФИО и e-mail обязательны" }, { status: 400 });
  }

  // Проверка прав: автор проекта, НР или админ
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      supervisor: { select: { userId: true } },
      members: { where: { isCreator: true }, select: { student: { select: { userId: true } } } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isAuthor = project.members.some((m) => m.student?.userId === session.user.id);
  const isSupervisor = project.supervisor?.userId === session.user.id;

  if (!isAdmin && !isAuthor && !isSupervisor) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  // Проверяем дубликат по email в этом проекте
  const existing = await prisma.projectMember.findFirst({
    where: {
      projectId: id,
      OR: [
        { manualEmail: email },
        { student: { user: { email } } },
      ],
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Участник с таким e-mail уже в проекте" }, { status: 409 });
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId: id,
      manualName: name,
      manualEmail: email,
      manualDirection: direction || null,
      role: role || null,
      inSystem: false,
    },
  });

  await prisma.activity.create({
    data: {
      projectId: id,
      action: `Участник ${name} добавлен в команду вручную`,
      actorEmail: session.user.email,
    },
  });

  return NextResponse.json(member, { status: 201 });
}

// DELETE /api/projects/[id]/manual-members — удалить ручного участника
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const { memberId } = await request.json();

  if (!memberId) {
    return NextResponse.json({ error: "memberId обязателен" }, { status: 400 });
  }

  const member = await prisma.projectMember.findUnique({
    where: { id: memberId },
    select: { projectId: true, manualName: true, inSystem: true },
  });

  if (!member || member.projectId !== id) {
    return NextResponse.json({ error: "Участник не найден" }, { status: 404 });
  }

  // Проверка прав
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      supervisor: { select: { userId: true } },
      members: { where: { isCreator: true }, select: { student: { select: { userId: true } } } },
    },
  });

  const isAdmin = session.user.role === "ADMIN";
  const isAuthor = project?.members.some((m) => m.student?.userId === session.user.id);
  const isSupervisor = project?.supervisor?.userId === session.user.id;

  if (!isAdmin && !isAuthor && !isSupervisor) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  await prisma.projectMember.delete({ where: { id: memberId } });

  await prisma.activity.create({
    data: {
      projectId: id,
      action: `Участник ${member.manualName || "—"} удалён из команды`,
      actorEmail: session.user.email,
    },
  });

  return NextResponse.json({ ok: true });
}
