import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mailShell, safeMail, escapeHtml } from "@/lib/expert-requests";

// FR-08: роль эксперта у научного руководителя (08.05, A2).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 3.4), specs/08-FR-08-requirements-v2.md (A2)
//
// Роль = наличие ExpertProfile. Поле User.role не трогаем: у НР там SUPERVISOR,
// перезапись отрезала бы его от научного руководства. Так одна почта держит обе роли.
// Подключить роль может сам НР («Принять участие») или админ — логика общая.

/** Поля карточки, которые берутся из профиля научного руководителя */
export type CardPrefill = {
  workplace: string;
  position: string;
  academicTitle: string;
  academicDegree: string;
  resumeUrl: string | null;
  photoUrl: string | null;
  expertise: string[];
  directions: string[];
  projectTypes: string[];
  contact: string;
};

/** Обязательный минимум для попадания карточки в каталог (08.08) */
export function isCardComplete(data: {
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

/** Карточка ни разу не заполнялась: пусто всё, что подтягивается из профиля НР */
export function isCardUntouched(card: CardPrefill): boolean {
  return (
    !card.workplace.trim() &&
    !card.position.trim() &&
    !card.resumeUrl?.trim() &&
    card.expertise.length === 0 &&
    card.directions.length === 0 &&
    !card.contact.trim()
  );
}

/** Карточка из профиля научного руководителя. null — профиля ещё нет */
export async function supervisorCardPrefill(userId: string): Promise<CardPrefill | null> {
  const sv = await prisma.supervisorProfile.findUnique({
    where: { userId },
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
  if (!sv) return null;
  return {
    workplace: sv.workplace ?? "",
    position: sv.position ?? "",
    academicTitle: sv.academicTitle ?? "",
    academicDegree: sv.academicDegree ?? "",
    resumeUrl: sv.resumeUrl ?? null,
    photoUrl: sv.photoUrl ?? null,
    expertise: sv.expertise ?? [],
    directions: sv.directions ?? [],
    projectTypes: sv.projectTypes ?? [],
    contact: sv.contact ?? "",
  };
}

const EMPTY_CARD: CardPrefill = {
  workplace: "",
  position: "",
  academicTitle: "",
  academicDegree: "",
  resumeUrl: null,
  photoUrl: null,
  expertise: [],
  directions: [],
  projectTypes: [],
  contact: "",
};

/**
 * Выдать научному руководителю роль эксперта. Идемпотентно: повторный вызов ничего
 * не меняет. Карточка заполняется из профиля НР и дальше правится отдельно.
 * Если профиля ещё нет (админ только что завёл аккаунт), карточка пустая — поля
 * подскажет GET /api/expert/profile, когда профиль появится.
 */
export async function grantExpertRole(
  userId: string
): Promise<{ created: boolean; cardCompleted: boolean }> {
  const existing = await prisma.expertProfile.findUnique({
    where: { userId },
    select: { cardCompleted: true },
  });
  if (existing) return { created: false, cardCompleted: existing.cardCompleted };

  const prefilled = (await supervisorCardPrefill(userId)) ?? EMPTY_CARD;
  const cardCompleted = isCardComplete(prefilled);
  try {
    await prisma.expertProfile.create({ data: { ...prefilled, cardCompleted, userId } });
  } catch (err) {
    // Два одновременных вызова: карточку уже создал соседний — роль есть
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const card = await prisma.expertProfile.findUnique({ where: { userId }, select: { cardCompleted: true } });
      return { created: false, cardCompleted: card?.cardCompleted ?? false };
    }
    throw err;
  }
  return { created: true, cardCompleted };
}

/** Письмо научному руководителю, которому админ открыл роль эксперта (A2) */
export async function mailExpertRoleGranted(
  email: string,
  name: string | null,
  cardCompleted: boolean
) {
  const greeting = name?.trim() ? `Здравствуйте, ${escapeHtml(name.trim())}!` : "Здравствуйте!";
  await safeMail(
    email,
    "Вам открыт раздел «Экспертная труба»",
    mailShell(
      "Вам открыт раздел «Экспертная труба»",
      `<p style="color:#333;font-size:15px;">${greeting}</p>
       <p style="color:#333;font-size:15px;">Администратор платформы ВКР открыл вам роль эксперта. Эксперты безвозмездно консультируют студентов по своим темам.</p>
       <p style="color:#555;font-size:14px;">Карточку эксперта мы заполнили из вашего профиля научного руководителя — проверьте её и дополните темы, доменную экспертизу и контакты. ${
         cardCompleted
           ? "Карточка уже в каталоге."
           : "Карточка появится в каталоге, как только будет заполнен обязательный минимум."
       } Скрыть карточку можно в любой момент.</p>
       <p style="color:#555;font-size:14px;">Переключиться между платформой ВКР и экспертной трубой можно в меню, без повторного входа.</p>`,
      "/expert/profile",
      "Открыть карточку эксперта"
    )
  );
}
