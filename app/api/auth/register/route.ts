import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, token, agreement } = await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: "Все поля обязательны" },
        { status: 400 }
      );
    }

    if (!agreement) {
      return NextResponse.json(
        { error: "Необходимо принять соглашение на обработку данных" },
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
    let isInvited = false;
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

      isInvited = true;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Приглашённые НР — email подтверждён автоматически
    const emailVerified = isInvited;

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        emailVerified,
        agreementAccepted: true,
      },
    });

    // Обновляем статус приглашения на ACCEPTED
    if (token) {
      await prisma.invitation.update({
        where: { token },
        data: { status: "ACCEPTED" },
      });
    }

    // Если email не подтверждён — отправляем код
    if (!emailVerified) {
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 минут

      // Удаляем старые коды для этого email
      await prisma.emailVerification.deleteMany({ where: { email } });

      await prisma.emailVerification.create({
        data: { email, code, expiresAt },
      });

      await sendMail({
        to: email,
        subject: "Подтверждение email — Платформа ВКР",
        html: `
          <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #003092; margin-bottom: 16px;">Подтверждение email</h2>
            <p>Здравствуйте, ${name}!</p>
            <p>Ваш код подтверждения:</p>
            <div style="background: #f0f4ff; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #003092; border-radius: 8px; margin: 16px 0;">
              ${code}
            </div>
            <p style="color: #666; font-size: 14px;">Код действителен 30 минут.</p>
            <p style="color: #666; font-size: 14px;">Если вы не регистрировались на платформе, проигнорируйте это письмо.</p>
          </div>
        `,
      });
    }

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
