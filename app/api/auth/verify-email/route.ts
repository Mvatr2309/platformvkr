import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/verify-email — подтвердить email по коду
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Укажите email и код" },
        { status: 400 }
      );
    }

    const verification = await prisma.emailVerification.findFirst({
      where: { email, code },
    });

    if (!verification) {
      return NextResponse.json(
        { error: "Неверный код подтверждения" },
        { status: 400 }
      );
    }

    if (verification.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Код истёк. Запросите новый." },
        { status: 400 }
      );
    }

    // Подтверждаем email пользователя
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });

    // Удаляем использованные коды
    await prisma.emailVerification.deleteMany({ where: { email } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

// PUT /api/auth/verify-email — повторная отправка кода
export async function PUT(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Укажите email" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email уже подтверждён" },
        { status: 400 }
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

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
          <p>Здравствуйте, ${user.name}!</p>
          <p>Ваш новый код подтверждения:</p>
          <div style="background: #f0f4ff; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #003092; border-radius: 8px; margin: 16px 0;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">Код действителен 30 минут.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Ошибка отправки письма" },
      { status: 500 }
    );
  }
}
