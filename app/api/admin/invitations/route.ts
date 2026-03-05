import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

// Шаблон письма-приглашения (09-CJM-supervisor: персонализированное письмо с пользой)
function invitationEmailHtml(name: string, token: string) {
  const registerUrl = `${process.env.NEXTAUTH_URL}/register?token=${token}`;
  return `
    <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #003092; margin-bottom: 16px;">Приглашение на платформу ВКР</h2>
      <p style="color: #333; font-size: 16px; line-height: 1.5;">
        Уважаемый(ая) <strong>${name}</strong>,
      </p>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        Вы приглашены зарегистрироваться на платформе управления выпускными квалификационными работами.
        Платформа поможет вам удобно управлять проектами, находить студентов и отслеживать прогресс.
      </p>
      <p style="margin: 24px 0;">
        <a href="${registerUrl}"
           style="display: inline-block; background: #E8375A; color: #fff; padding: 14px 28px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Зарегистрироваться
        </a>
      </p>
      <p style="color: #999; font-size: 13px;">
        Если кнопка не работает, скопируйте ссылку:<br/>
        <a href="${registerUrl}" style="color: #123194;">${registerUrl}</a>
      </p>
    </div>
  `;
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

    const invitation = await prisma.invitation.create({
      data: {
        name,
        email,
        sentById: session.user.id,
      },
    });

    // Отправляем email
    await sendMail({
      to: email,
      subject: "Приглашение на платформу ВКР — регистрация научного руководителя",
      html: invitationEmailHtml(name, invitation.token),
    });

    return NextResponse.json(invitation, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ошибка при отправке приглашения" },
      { status: 500 }
    );
  }
}
