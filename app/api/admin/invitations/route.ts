import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

// Генерация случайного пароля
function generatePassword(length = 10) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

// DELETE /api/admin/invitations — удалить аккаунт и приглашение
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const { invitationId } = await request.json();

    if (!invitationId) {
      return NextResponse.json({ error: "ID приглашения обязателен" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Приглашение не найдено" }, { status: 404 });
    }

    // Находим пользователя по email из приглашения
    const user = await prisma.user.findUnique({
      where: { email: invitation.email },
      include: {
        student: { select: { id: true } },
        supervisor: { select: { id: true } },
      },
    });

    if (user) {
      // Удаляем связанные записи перед удалением пользователя
      if (user.student) {
        await prisma.projectMember.deleteMany({ where: { studentId: user.student.id } });
        await prisma.application.deleteMany({ where: { studentId: user.student.id } });
      }
      if (user.supervisor) {
        await prisma.application.deleteMany({ where: { supervisorId: user.supervisor.id } });
        // Убираем НР из проектов
        await prisma.project.updateMany({
          where: { supervisorId: user.supervisor.id },
          data: { supervisorId: null },
        });
      }
      // Удаляем уведомления
      await prisma.notification.deleteMany({ where: { userId: user.id } });
      // Удаляем пользователя (каскадно удалит профили)
      await prisma.user.delete({ where: { id: user.id } });
    }

    // Удаляем приглашение
    await prisma.invitation.delete({ where: { id: invitationId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting account:", err);
    return NextResponse.json(
      { error: "Ошибка при удалении аккаунта" },
      { status: 500 }
    );
  }
}

// GET /api/admin/invitations — список приглашений
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
    include: { sentBy: { select: { name: true } } },
  });

  return NextResponse.json(invitations);
}

// POST /api/admin/invitations — создать аккаунт и отправить данные на почту
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const { email, role, cohort } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "E-mail обязателен" },
        { status: 400 }
      );
    }

    const userRole = role === "STUDENT" ? "STUDENT" : "SUPERVISOR";

    // Проверяем, не зарегистрирован ли уже пользователь с таким email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким e-mail уже зарегистрирован" },
        { status: 409 }
      );
    }

    // Проверяем, нет ли активного приглашения
    const existingInvitation = await prisma.invitation.findFirst({
      where: { email, status: "SENT" },
    });
    if (existingInvitation) {
      return NextResponse.json(
        { error: "Приглашение уже отправлено на этот e-mail" },
        { status: 409 }
      );
    }

    // Генерируем пароль и создаём аккаунт
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: userRole,
        emailVerified: true,
      },
    });

    // Для студентов создаём профиль с когортой
    if (userRole === "STUDENT" && cohort) {
      await prisma.studentProfile.create({
        data: {
          userId: user.id,
          cohort,
          direction: "",
          course: 1,
          competencies: [],
          desiredRoles: [],
          contact: "",
        },
      });
    }

    const invitation = await prisma.invitation.create({
      data: {
        email,
        sentById: session.user.id,
        status: "ACCEPTED",
      },
    });

    // Отправляем письмо с данными для входа
    const roleLabel = userRole === "SUPERVISOR" ? "научного руководителя" : "студента";
    const platformUrl = process.env.NEXTAUTH_URL || "https://vkr-platform.ru";

    try {
      await sendMail({
        to: email,
        subject: "Доступ к платформе ВКР",
        html: `
          <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #003092; margin-bottom: 16px;">Добро пожаловать на платформу ВКР</h2>
            <p>Здравствуйте!</p>
            <p>Для вас создан аккаунт ${roleLabel} на платформе управления ВКР.</p>
            <div style="background: #f0f4ff; padding: 20px; margin: 16px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Логин:</strong> ${email}</p>
              <p style="margin: 0;"><strong>Пароль:</strong> ${password}</p>
            </div>
            <p>После входа необходимо заполнить профиль — без этого доступ к платформе будет ограничен.</p>
            <p>
              <a href="${platformUrl}/login"
                 style="display: inline-block; background: #E8375A; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: 600;">
                Войти на платформу
              </a>
            </p>
          </div>
        `,
      });
    } catch (mailErr) {
      const errMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.error("Failed to send invitation email to", email, ":", errMsg);
      // Аккаунт создан, но письмо не отправлено
      return NextResponse.json(
        { ...invitation, userId: user.id, generatedPassword: password, emailError: errMsg },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { ...invitation, userId: user.id, generatedPassword: password },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Ошибка при создании аккаунта" },
      { status: 500 }
    );
  }
}
