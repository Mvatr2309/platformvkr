import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// Максимальный размер команды: автор + 2 тиммейта = 3 участника (научный руководитель не считается).
export const MAX_TEAM_MEMBERS = 3;

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
      _count: { select: { members: true } },
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

  // Лимит размера команды: автор + 2 тиммейта = 3 участника (НР не в счёт)
  if (project._count.members >= MAX_TEAM_MEMBERS) {
    return NextResponse.json(
      { error: `В команде может быть максимум ${MAX_TEAM_MEMBERS} участника. Больше добавить нельзя.` },
      { status: 400 }
    );
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

  // Если студент с такой почтой уже зарегистрирован — привязываем участие к его аккаунту,
  // чтобы он видел проект в «Мои проекты», а не числился «не в системе».
  const linkedStudent = await prisma.studentProfile.findFirst({
    where: { user: { email: { equals: email, mode: "insensitive" }, role: "STUDENT" } },
    select: { id: true, userId: true },
  });

  // В команду можно добавлять только зарегистрированных студентов.
  // Доступы выдаются админами вручную, поэтому «внешних» участников быть не должно.
  if (!linkedStudent) {
    return NextResponse.json(
      {
        error: "Студента с такой почтой нет в системе. Добавить можно только зарегистрированного студента — проверьте почту или дождитесь, пока ему откроют доступ.",
      },
      { status: 400 }
    );
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId: id,
      studentId: linkedStudent.id,
      role: role || null,
      inSystem: true,
      // сохраняем введённое автором ФИО как запасное имя — покажется, пока студент не заполнил профиль
      manualName: name || null,
    },
  });

  await prisma.activity.create({
    data: {
      projectId: id,
      action: `Участник ${name} добавлен в команду`,
      actorEmail: session.user.email,
    },
  });

  // Уведомляем добавленного студента, если он в системе
  if (linkedStudent) {
    const proj = await prisma.project.findUnique({ where: { id }, select: { title: true } });
    notify({
      userId: linkedStudent.userId,
      type: "PROJECT_STATUS",
      title: "Вас добавили в проект",
      message: `Вас добавили в команду проекта «${proj?.title ?? ""}»`,
      link: `/projects/${id}`,
    }).catch(() => {});
  }

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
