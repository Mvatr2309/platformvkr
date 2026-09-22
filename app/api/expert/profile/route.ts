import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types/roles";

// FR-08: карточка эксперта (08.08, 08.09).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 5.2)

/** Обязательный минимум для попадания карточки в каталог */
function isCardComplete(data: {
  workplace?: string | null;
  position?: string | null;
  resumeUrl?: string | null;
  expertise?: string[] | null;
  contact?: string | null;
}): boolean {
  return Boolean(
    data.workplace?.trim() &&
      data.position?.trim() &&
      data.resumeUrl?.trim() &&
      (data.expertise?.length ?? 0) > 0 &&
      data.contact?.trim()
  );
}

/** Роли, которым карточка эксперта вообще положена */
function canHaveCard(role: string): boolean {
  return role === UserRole.SUPERVISOR || role === UserRole.EXPERT;
}

// GET /api/expert/profile — своя карточка
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!canHaveCard(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const profile = await prisma.expertProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    // Карточки ещё нет: у НР её создаёт POST /api/expert/join,
    // у приглашённого админом внешнего эксперта — первое сохранение
    return NextResponse.json(
      { profile: null, name: session.user.name ?? "", role: session.user.role },
      { status: 200 }
    );
  }

  return NextResponse.json({
    profile,
    name: session.user.name ?? "",
    role: session.user.role,
  });
}

// PUT /api/expert/profile — создать или обновить карточку
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!canHaveCard(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const data = await request.json();

    // Резюме обязательно: это подтверждение опыта, на котором держится смысл раздела
    const resumeUrl = (data.resumeUrl || "").trim();
    if (!resumeUrl) {
      return NextResponse.json(
        { error: "Прикрепите резюме (файл или ссылку)" },
        { status: 400 }
      );
    }

    const cardData = {
      workplace: (data.workplace || "").trim(),
      position: (data.position || "").trim(),
      academicTitle: (data.academicTitle || "").trim(),
      academicDegree: (data.academicDegree || "").trim(),
      resumeUrl,
      photoUrl: data.photoUrl || null,
      expertise: Array.isArray(data.expertise) ? data.expertise : [],
      helpTopics: data.helpTopics?.trim() ? data.helpTopics.trim() : null,
      directions: Array.isArray(data.directions) ? data.directions : [],
      projectTypes: Array.isArray(data.projectTypes) ? data.projectTypes : [],
      contact: (data.contact || "").trim(),
      hiddenByOwner: Boolean(data.hiddenByOwner),
    };

    const profile = await prisma.expertProfile.upsert({
      where: { userId: session.user.id },
      update: { ...cardData, cardCompleted: isCardComplete(cardData) },
      create: {
        ...cardData,
        cardCompleted: isCardComplete(cardData),
        userId: session.user.id,
      },
    });

    // ФИО берётся из учётной записи — обновляем, если его прислали
    const userUpdate: Record<string, unknown> = {};
    if (data.name && data.name.trim()) userUpdate.name = data.name.trim();
    // Для внешнего эксперта карточка и есть профиль: её сохранение закрывает
    // профильный гейт. У НР profileCompleted управляется профилем научрука.
    if (session.user.role === UserRole.EXPERT) {
      userUpdate.profileCompleted = true;
      userUpdate.agreementAccepted = true;
    }
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: session.user.id }, data: userUpdate });
    }

    const response = NextResponse.json(profile);
    if (session.user.role === UserRole.EXPERT) {
      // Cookie-флаг для middleware: JWT может быть устаревшим
      response.cookies.set("profile_completed", "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch {
    return NextResponse.json({ error: "Ошибка сохранения карточки" }, { status: 500 });
  }
}
