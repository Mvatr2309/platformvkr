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

  // Добавляем ФИО из User
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  return NextResponse.json({ ...profile, name: user?.name || "" });
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

    // Без модерации — профиль сразу APPROVED при сохранении
    const status = "APPROVED" as const;

    const existing = await prisma.supervisorProfile.findUnique({
      where: { userId: session.user.id },
    });

    let profile;

    if (existing) {
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

    // Обновляем User (ФИО, соглашение, profileCompleted)
    const userUpdate: Record<string, unknown> = {
      profileCompleted: true,
      agreementAccepted: true,
    };
    if (data.name && data.name.trim()) userUpdate.name = data.name.trim();
    await prisma.user.update({
      where: { id: session.user.id },
      data: userUpdate,
    });

    const response = NextResponse.json(profile);
    // Cookie-флаг для middleware — JWT может быть устаревшим
    response.cookies.set("profile_completed", "1", {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Ошибка сохранения профиля" },
      { status: 500 }
    );
  }
}
