import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types/roles";

// FR-08: подключение роли эксперта научным руководителем (08.05).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 3.4)
//
// Роль = наличие ExpertProfile. Поле User.role не трогаем: у НР там SUPERVISOR,
// перезапись отрезала бы его от научного руководства. Модерации нет — роль
// появляется сразу, клиент после ответа вызывает updateSession().

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Подключить роль себе может только научный руководитель.
  // Внешних экспертов создаёт админ из админки трубы, у админа своя роль.
  if (session.user.role !== UserRole.SUPERVISOR) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const existing = await prisma.expertProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (existing) {
    // Идемпотентно: повторное нажатие ничего не ломает
    return NextResponse.json({ created: false });
  }

  // Предзаполняем карточку из профиля НР. Дальше она правится отдельно
  // и с профилем научрука не синхронизируется.
  const sv = await prisma.supervisorProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      workplace: true,
      position: true,
      academicTitle: true,
      academicDegree: true,
      resumeUrl: true,
      photoUrl: true,
      expertise: true,
      directions: true,
      projectTypes: true,
      contact: true,
    },
  });

  const prefilled = {
    workplace: sv?.workplace ?? "",
    position: sv?.position ?? "",
    academicTitle: sv?.academicTitle ?? "",
    academicDegree: sv?.academicDegree ?? "",
    resumeUrl: sv?.resumeUrl ?? null,
    photoUrl: sv?.photoUrl ?? null,
    expertise: sv?.expertise ?? [],
    directions: sv?.directions ?? [],
    projectTypes: sv?.projectTypes ?? [],
    contact: sv?.contact ?? "",
  };

  // Карточка попадёт в каталог сразу, если из профиля НР приехал весь минимум
  const cardCompleted = Boolean(
    prefilled.workplace.trim() &&
      prefilled.position.trim() &&
      prefilled.resumeUrl?.trim() &&
      prefilled.expertise.length > 0 &&
      prefilled.contact.trim()
  );

  await prisma.expertProfile.create({
    data: { ...prefilled, cardCompleted, userId: session.user.id },
  });

  return NextResponse.json({ created: true, cardCompleted });
}
