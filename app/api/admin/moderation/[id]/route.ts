import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { notify } from "@/lib/notify";

// GET /api/admin/moderation/[id] — детальный просмотр профиля
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;

  const profile = await prisma.supervisorProfile.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

// PUT /api/admin/moderation/[id] — подтвердить или отклонить
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const { action, comment } = await request.json();

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Недопустимое действие" }, { status: 400 });
  }

  const profile = await prisma.supervisorProfile.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  const newStatus = action === "approve" ? "APPROVED" : "REJECTED";

  const updated = await prisma.supervisorProfile.update({
    where: { id },
    data: {
      status: newStatus,
      moderationComment: action === "reject" ? comment || null : null,
    },
  });

  // In-app уведомление НР
  notify({
    userId: profile.userId,
    type: action === "approve" ? "PROFILE_APPROVED" : "PROFILE_REJECTED",
    title: action === "approve" ? "Профиль подтверждён" : "Профиль отклонён",
    message: action === "approve"
      ? "Ваш профиль научного руководителя подтверждён. Теперь вы можете создавать проекты."
      : `Ваш профиль отклонён.${comment ? ` Комментарий: ${comment}` : ""} Отредактируйте и отправьте повторно.`,
    link: "/profile",
  }).catch(() => {});

  // E-mail уведомление о результате (01.05)
  try {
    const isApproved = action === "approve";
    await sendMail({
      to: profile.user.email,
      subject: isApproved
        ? "Профиль подтверждён — Платформа ВКР"
        : "Профиль отклонён — Платформа ВКР",
      html: `
        <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #003092; margin-bottom: 16px;">
            ${isApproved ? "Ваш профиль подтверждён" : "Профиль требует доработки"}
          </h2>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            Уважаемый(ая) <strong>${profile.user.name}</strong>,
          </p>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            ${isApproved
              ? "Ваш профиль научного руководителя успешно подтверждён. Теперь вы можете создавать проекты и принимать заявки студентов."
              : `Ваш профиль был отклонён модератором.${comment ? ` Комментарий: ${comment}` : ""} Вы можете отредактировать профиль и отправить его повторно.`
            }
          </p>
          <p style="margin: 24px 0;">
            <a href="${process.env.NEXTAUTH_URL}/profile"
               style="display: inline-block; background: #E8375A; color: #fff; padding: 14px 28px; text-decoration: none; font-weight: 600; font-size: 15px;">
              ${isApproved ? "Перейти на платформу" : "Редактировать профиль"}
            </a>
          </p>
        </div>
      `,
    });
  } catch {
    // Email не критичен — не блокируем ответ
  }

  return NextResponse.json(updated);
}
