import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, token } = await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: "Все поля обязательны" },
        { status: 400 }
      );
    }

    if (!["SUPERVISOR", "STUDENT"].includes(role)) {
      return NextResponse.json(
        { error: "Недопустимая роль" },
        { status: 400 }
      );
    }

    // Если есть токен приглашения — проверяем его (FR-01, 01.01)
    if (token) {
      const invitation = await prisma.invitation.findUnique({
        where: { token },
      });

      if (!invitation) {
        return NextResponse.json(
          { error: "Недействительный токен приглашения" },
          { status: 400 }
        );
      }

      if (invitation.status !== "SENT") {
        return NextResponse.json(
          { error: "Приглашение уже использовано или истекло" },
          { status: 400 }
        );
      }

      if (invitation.email !== email) {
        return NextResponse.json(
          { error: "E-mail не совпадает с приглашением" },
          { status: 400 }
        );
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
      },
    });

    // Обновляем статус приглашения на ACCEPTED
    if (token) {
      await prisma.invitation.update({
        where: { token },
        data: { status: "ACCEPTED" },
      });
    }

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
