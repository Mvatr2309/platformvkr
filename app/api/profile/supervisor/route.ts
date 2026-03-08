import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — получить профиль текущего НР
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const profile = await prisma.supervisorProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json(null);
  }

  return NextResponse.json(profile);
}

// PUT — создать или обновить профиль НР
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const data = await request.json();

    const profileData = {
      workplace: data.workplace || "",
      position: data.position || "",
      academicTitle: data.academicTitle || "",
      academicDegree: data.academicDegree || "",
      resumeUrl: data.resumeUrl || null,
      photoUrl: data.photoUrl || null,
      expertise: data.expertise || [],
      workPreferences: data.workPreferences || [],
      proposedTopics: data.proposedTopics || null,
      directions: data.directions || [],
      maxSlots: data.maxSlots || 3,
      contact: data.contact || "",
    };

    // Приглашённый НР? Если есть Invitation — профиль сразу APPROVED
    const invitation = await prisma.invitation.findFirst({
      where: { email: session.user.email!, status: "ACCEPTED" },
    });
    const isInvited = !!invitation;

    // Определяем статус:
    // - Приглашённый НР: при submit → сразу APPROVED (модерация не нужна)
    // - Самостоятельная регистрация: submit → PENDING (модерация)
    // - Без submit: DRAFT (черновик)
    const status = !data.submit ? "DRAFT" as const
      : isInvited ? "APPROVED" as const
      : "PENDING" as const;

    const existing = await prisma.supervisorProfile.findUnique({
      where: { userId: session.user.id },
    });

    let profile;

    if (existing) {
      // Нельзя редактировать профиль, уже находящийся на модерации
      if (existing.status === "PENDING" && data.submit) {
        return NextResponse.json(
          { error: "Профиль уже на модерации" },
          { status: 400 }
        );
      }

      profile = await prisma.supervisorProfile.update({
        where: { userId: session.user.id },
        data: { ...profileData, status },
      });
    } else {
      profile = await prisma.supervisorProfile.create({
        data: {
          ...profileData,
          status,
          userId: session.user.id,
        },
      });
    }

    // Обновляем User (соглашение + ФИО)
    const userUpdate: Record<string, unknown> = {};
    if (data.agreementAccepted !== undefined) userUpdate.agreementAccepted = data.agreementAccepted;
    if (data.name && data.name.trim()) userUpdate.name = data.name.trim();
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: userUpdate,
      });
    }

    return NextResponse.json(profile);
  } catch {
    return NextResponse.json(
      { error: "Ошибка сохранения профиля" },
      { status: 500 }
    );
  }
}
