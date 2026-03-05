import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Генерация случайного пароля
function generatePassword(length = 10) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
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

// POST /api/admin/invitations — создать и отправить приглашение
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "ФИО и e-mail обязательны" },
        { status: 400 }
      );
    }

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

    // Генерируем пароль и создаём аккаунт сразу
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "SUPERVISOR",
        agreementAccepted: true,
      },
    });

    const invitation = await prisma.invitation.create({
      data: {
        name,
        email,
        sentById: session.user.id,
        status: "ACCEPTED",
      },
    });

    return NextResponse.json(
      { ...invitation, userId: user.id, generatedPassword: password },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Ошибка при отправке приглашения" },
      { status: 500 }
    );
  }
}
