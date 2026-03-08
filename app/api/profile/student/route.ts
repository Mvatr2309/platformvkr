import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — получить профиль студента
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(profile);
}

// PUT — создать или обновить профиль студента (05.06)
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const data = await request.json();

    // Когорта устанавливается только админом при создании аккаунта
    const profileFields = {
      direction: data.direction || "",
      course: data.course || 1,
      competencies: data.competencies || [],
      desiredRoles: data.desiredRoles || [],
      portfolioUrl: data.portfolioUrl || null,
      contact: data.contact || "",
    };

    const existing = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });

    let profile;
    if (existing) {
      profile = await prisma.studentProfile.update({
        where: { userId: session.user.id },
        data: profileFields,
      });
    } else {
      profile = await prisma.studentProfile.create({
        data: {
          ...profileFields,
          cohort: "",
          userId: session.user.id,
        },
      });
    }

    // Обновляем User (ФИО, profileCompleted)
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
