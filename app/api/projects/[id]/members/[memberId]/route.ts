import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// DELETE /api/projects/[id]/members/[memberId] — удаление участника из проекта
// Права:
//   Админ — может удалить всех
//   НР проекта — может удалить всех, кроме автора
//   Автор проекта — может удалить всех
//   Участник — может удалить только себя
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id: projectId, memberId } = await params;

  // Получаем участника, которого хотят удалить
  const member = await prisma.projectMember.findUnique({
    where: { id: memberId },
    include: { student: { select: { userId: true } } },
  });

  if (!member || member.projectId !== projectId) {
    return NextResponse.json({ error: "Участник не найден" }, { status: 404 });
  }

  // Определяем роли текущего пользователя
  const isAdmin = session.user.role === "ADMIN";

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      supervisor: { select: { userId: true } },
      members: { select: { isCreator: true, student: { select: { userId: true } } } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const isSupervisor = project.supervisor?.userId === session.user.id;
  const isCreator = project.members.some(
    (m) => m.isCreator && m.student.userId === session.user.id
  );
  const isSelf = member.student.userId === session.user.id;
  const targetIsCreator = member.isCreator;

  // Проверка прав
  if (!isAdmin && !isSupervisor && !isCreator && !isSelf) {
    return NextResponse.json({ error: "Нет прав на удаление участника" }, { status: 403 });
  }

  // НР не может удалить автора
  if (isSupervisor && !isAdmin && !isCreator && targetIsCreator) {
    return NextResponse.json({ error: "Научный руководитель не может удалить автора проекта" }, { status: 403 });
  }

  // Автор не может удалить сам себя (он может удалить проект целиком)
  if (isSelf && targetIsCreator && !isAdmin) {
    return NextResponse.json({ error: "Автор не может покинуть проект. Удалите проект, если хотите." }, { status: 400 });
  }

  await prisma.projectMember.delete({ where: { id: memberId } });

  // Запись в ленту активности
  const deletedStudent = await prisma.studentProfile.findUnique({
    where: { id: member.studentId },
    select: { user: { select: { name: true } } },
  });

  await prisma.activity.create({
    data: {
      projectId,
      action: isSelf
        ? `${deletedStudent?.user.name || "Участник"} покинул проект`
        : `${deletedStudent?.user.name || "Участник"} удалён из команды`,
      actorEmail: session.user.email,
    },
  });

  // Уведомление удалённому участнику
  if (!isSelf) {
    notify({
      userId: member.student.userId,
      type: "PROJECT_STATUS",
      title: "Вы удалены из проекта",
      message: `Вы были удалены из проекта «${project.title}»`,
      link: `/my-projects`,
    }).catch(() => {});
  }

  // Уведомление автору проекта, если участник покинул проект сам
  if (isSelf) {
    const creator = project.members.find((m) => m.isCreator);
    if (creator && creator.student.userId !== session.user.id) {
      notify({
        userId: creator.student.userId,
        type: "PROJECT_STATUS",
        title: "Участник покинул проект",
        message: `${deletedStudent?.user.name || "Участник"} покинул проект «${project.title}»`,
        link: `/projects/${projectId}`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
