import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

function invitationEmailHtml(name: string, token: string) {
  const registerUrl = `${process.env.NEXTAUTH_URL}/register?token=${token}`;
  return `
    <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #003092; margin-bottom: 16px;">Приглашение на платформу ВКР</h2>
      <p style="color: #333; font-size: 16px; line-height: 1.5;">
        Уважаемый(ая) <strong>${name}</strong>,
      </p>
      <p style="color: #555; font-size: 15px; line-height: 1.6;">
        Напоминаем, что вы приглашены зарегистрироваться на платформе управления ВКР.
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

// POST /api/admin/invitations/[id]/resend — повторная отправка
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) {
      return NextResponse.json(
        { error: "Приглашение не найдено" },
        { status: 404 }
      );
    }

    if (invitation.status !== "SENT") {
      return NextResponse.json(
        { error: "Повторная отправка возможна только для активных приглашений" },
        { status: 400 }
      );
    }

    await sendMail({
      to: invitation.email,
      subject: "Напоминание: приглашение на платформу ВКР",
      html: invitationEmailHtml(invitation.name, invitation.token),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Ошибка при повторной отправке" },
      { status: 500 }
    );
  }
}
