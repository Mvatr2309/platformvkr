import "server-only";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types/roles";

// FR-08: доступ к пространствам «Платформа ВКР» и «Экспертная труба».
// Источник: specs/08-FR-08-expert-pipeline.md (разделы 3.2, 4)
//
// Единая точка правды: этим хелпером пользуются экран выбора, гейты страниц
// и API трубы. Замок на плитке — только визуальная часть, доступ проверяется
// на сервере (08.07).

/** Состояние плитки пространства (08.02) */
export type SpaceState =
  | "OPEN"    // Кликабельна, пространство доступно
  | "LOCKED"  // Замок, некликабельна
  | "INVITE"; // Ведёт на подключение роли эксперта

export type SpaceAccess = {
  state: SpaceState;
  /** Куда ведёт плитка. Для LOCKED — null */
  href: string | null;
};

export type SpacesAccess = {
  userId: string;
  role: string;
  vkr: SpaceAccess;
  expert: SpaceAccess;
};

/**
 * Считает доступ к обоим пространствам для текущего пользователя.
 * Возвращает null, если пользователь не авторизован.
 */
export async function getSpacesAccess(): Promise<SpacesAccess | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const role = user.role;

  // Админ — модератор трубы, доступ к обоим пространствам всегда (08.07)
  if (role === UserRole.ADMIN) {
    return {
      userId: user.id,
      role,
      vkr: { state: "OPEN", href: "/admin/dashboard" },
      expert: { state: "OPEN", href: "/expert/admin/requests" },
    };
  }

  // Внешний эксперт: труба открыта, «Платформа ВКР» закрыта наглухо
  if (role === UserRole.EXPERT) {
    return {
      userId: user.id,
      role,
      vkr: { state: "LOCKED", href: null },
      expert: { state: "OPEN", href: "/expert" },
    };
  }

  // Научный руководитель: труба доступна, если он подключил себе роль эксперта,
  // иначе плитка приглашает подключить (08.05)
  if (role === UserRole.SUPERVISOR) {
    const hasCard = await prisma.expertProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return {
      userId: user.id,
      role,
      vkr: { state: "OPEN", href: "/my-projects" },
      expert: hasCard
        ? { state: "OPEN", href: "/expert" }
        : { state: "INVITE", href: "/expert/join" },
    };
  }

  // Студент: труба открыта, только если его поток отмечен админом (08.07).
  // Пустая когорта = доступа нет.
  if (role === UserRole.STUDENT) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { cohort: true },
    });
    const cohort = profile?.cohort?.trim() ?? "";
    const isOpen = cohort
      ? Boolean(
          await prisma.expertPipelineCohortAccess.findFirst({
            where: { cohort, isOpen: true },
            select: { id: true },
          })
        )
      : false;
    return {
      userId: user.id,
      role,
      vkr: { state: "OPEN", href: "/my-projects" },
      expert: isOpen
        ? { state: "OPEN", href: "/expert" }
        : { state: "LOCKED", href: null },
    };
  }

  // Неизвестная роль — в трубу не пускаем
  return {
    userId: user.id,
    role,
    vkr: { state: "OPEN", href: "/my-projects" },
    expert: { state: "LOCKED", href: null },
  };
}

/** Есть ли у пользователя доступ в пространство трубы (OPEN или INVITE) */
export async function canEnterExpertSpace(): Promise<{
  allowed: boolean;
  state: SpaceState;
  access: SpacesAccess | null;
}> {
  const access = await getSpacesAccess();
  if (!access) return { allowed: false, state: "LOCKED", access: null };
  const state = access.expert.state;
  return { allowed: state !== "LOCKED", state, access };
}
