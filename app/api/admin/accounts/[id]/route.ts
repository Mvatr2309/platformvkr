import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isGuardError } from "@/lib/api-guard";

// Собирает аккаунт + сводку по связанным данным, которые будут затронуты удалением.
async function loadAccountWithImpact(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      profileCompleted: true,
      createdAt: true,
      supervisor: { select: { id: true } },
      student: { select: { id: true } },
    },
  });
  if (!user) return null;

  const supId = user.supervisor?.id ?? null;
  const studId = user.student?.id ?? null;

  const [
    notifications,
    invitationsSent,
    feedbacks,
    supervisedProjects,
    supervisorApplications,
    memberships,
    studentApplications,
  ] = await Promise.all([
    prisma.notification.count({ where: { userId: id } }),
    prisma.invitation.count({ where: { sentById: id } }),
    prisma.feedback.count({ where: { userId: id } }),
    supId ? prisma.project.count({ where: { supervisorId: supId } }) : Promise.resolve(0),
    supId ? prisma.application.count({ where: { supervisorId: supId } }) : Promise.resolve(0),
    studId ? prisma.projectMember.count({ where: { studentId: studId } }) : Promise.resolve(0),
    studId ? prisma.application.count({ where: { studentId: studId } }) : Promise.resolve(0),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profileCompleted: user.profileCompleted,
      createdAt: user.createdAt,
    },
    impact: {
      notifications,
      invitationsSent,
      feedbacks,
      supervisedProjects,    // НР: проекты станут «без руководителя» (supervisorId → null)
      supervisorApplications,
      memberships,           // студент: участие в проектах будет удалено
      studentApplications,   // студент: заявки будут удалены
    },
  };
}

// GET /api/admin/accounts/[id] — предпросмотр последствий удаления
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { id } = await params;
  const data = await loadAccountWithImpact(id);
  if (!data) {
    return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE /api/admin/accounts/[id] — безопасное удаление аккаунта.
// Транзакция: чистим зависимости, которые на уровне БД имеют RESTRICT/нет FK,
// затем удаляем пользователя (профиль удаляется каскадом).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { id } = await params;

  // Защита от опасных операций
  if (id === guard.session.user.id) {
    return NextResponse.json(
      { error: "Нельзя удалить собственный аккаунт" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      supervisor: { select: { id: true } },
      student: { select: { id: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
  }

  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Удаление аккаунтов администраторов через этот раздел запрещено" },
      { status: 403 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Уведомления (нет FK на User — иначе осиротеют)
      await tx.notification.deleteMany({ where: { userId: id } });

      // 2. Приглашения, отправленные этим пользователем (FK RESTRICT)
      await tx.invitation.deleteMany({ where: { sentById: id } });

      // 3. Данные студента (FK RESTRICT на ProjectMember и Application)
      if (user.student) {
        const sid = user.student.id;
        await tx.application.deleteMany({ where: { studentId: sid } });
        await tx.projectMember.deleteMany({ where: { studentId: sid } });
      }

      // 4. Данные НР: проекты (supervisorId → null) и заявки (supervisorId → null)
      //    обрабатываются БД через ON DELETE SET NULL при удалении профиля.
      //    Проекты сохраняются и остаются доступными студентам-участникам.

      // 5. Удаляем пользователя — SupervisorProfile/StudentProfile/Feedback
      //    удаляются каскадом (ON DELETE CASCADE).
      await tx.user.delete({ where: { id } });
    });
  } catch (err) {
    console.error("Account deletion failed:", err);
    return NextResponse.json(
      { error: "Не удалось удалить аккаунт. Изменения отменены." },
      { status: 500 }
    );
  }

  console.log(
    `[ADMIN] ${guard.session.user.email} удалил аккаунт ${user.role} ${user.email} (${user.name || "без имени"})`
  );

  return NextResponse.json({ ok: true, deleted: { email: user.email, name: user.name, role: user.role } });
}
