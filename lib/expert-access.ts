import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types/roles";

// FR-08: доступ к пространствам «Платформа ВКР» и «Экспертная труба».
// Источник: specs/08-FR-08-expert-pipeline.md (разделы 3.2, 4),
// specs/08-FR-08-requirements-v2.md (A1)
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
 * Что открыто потоку студента. Запись о потоке заводит админ в «Доступ по потокам»;
 * нет записи — закрыто всё: новый поток не видит ничего, пока его не откроют (A1).
 */
async function getStudentCohortAccess(
  userId: string
): Promise<{ expertOpen: boolean; platformOpen: boolean }> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { cohort: true },
  });
  const cohort = profile?.cohort?.trim() ?? "";
  if (!cohort) return { expertOpen: false, platformOpen: false };

  const row = await prisma.expertPipelineCohortAccess.findUnique({
    where: { cohort },
    select: { isOpen: true, platformOpen: true },
  });
  return { expertOpen: row?.isOpen ?? false, platformOpen: row?.platformOpen ?? false };
}

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

  // Студент: оба пространства открываются по потоку, независимо друг от друга
  // (08.07, A1). Пустая когорта или поток без записи = закрыто.
  if (role === UserRole.STUDENT) {
    const cohortAccess = await getStudentCohortAccess(user.id);
    return {
      userId: user.id,
      role,
      vkr: cohortAccess.platformOpen
        ? { state: "OPEN", href: "/my-projects" }
        : { state: "LOCKED", href: null },
      expert: cohortAccess.expertOpen
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

/**
 * Можно ли открыть страницу «Платформы ВКР» (A1). Гейт страниц платформы —
 * components/layout/VkrGate.tsx. Внешнему эксперту платформа закрыта (08.02),
 * студенту — по потоку, остальным ролям открыта.
 */
export async function canEnterVkrSpace(): Promise<{ authed: boolean; allowed: boolean }> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return { authed: false, allowed: false };
  if (user.role === UserRole.EXPERT) return { authed: true, allowed: false };
  if (user.role !== UserRole.STUDENT) return { authed: true, allowed: true };
  const { platformOpen } = await getStudentCohortAccess(user.id);
  return { authed: true, allowed: platformOpen };
}

/**
 * Закрыта ли «Платформа ВКР» студенту по его потоку (A1). Для других ролей — false:
 * их доступ решают свои правила. Нужна там, где вместо 403 ответ сужается,
 * например в уведомлениях и онбординге.
 */
export async function isPlatformClosedForStudent(
  userId: string,
  role: string | undefined
): Promise<boolean> {
  if (role !== UserRole.STUDENT) return false;
  const { platformOpen } = await getStudentCohortAccess(userId);
  return !platformOpen;
}

/**
 * Гейт API «Платформы ВКР» для студента закрытого потока (A1).
 * Возвращает 403, если вызывает студент, которому платформа закрыта, иначе null —
 * и обработчик продолжает со своими проверками. Другие роли и анонимные вызовы
 * не трогает: их правила остаются в самих обработчиках.
 * Страницы платформы клиентские и берут данные через API, поэтому именно этот
 * гейт не даёт увидеть научников и проекты в обход заглушки.
 */
export async function denyClosedCohortStudent(): Promise<NextResponse | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !(await isPlatformClosedForStudent(user.id, user.role))) return null;
  return NextResponse.json(
    { error: "Платформа ВКР ещё не открыта для вашего потока" },
    { status: 403 }
  );
}
