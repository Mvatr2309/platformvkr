import "server-only";
import { prisma } from "@/lib/prisma";
import { getSpacesAccess } from "@/lib/expert-access";
import { UserRole } from "@/types/roles";

// FR-08: каталог экспертов для студента (08.10, 08.11).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 3.3, 7)

/**
 * Что отдаём в каталог. Поле contact сюда НЕ входит намеренно:
 * контакты эксперта видит только студент с принятым запросом (08.11).
 * Отсечение на уровне select, а не на клиенте — чтобы контакт физически
 * не попадал в ответ сервера.
 */
export const CATALOG_SELECT = {
  id: true,
  workplace: true,
  position: true,
  academicTitle: true,
  academicDegree: true,
  photoUrl: true,
  resumeUrl: true,
  expertise: true,
  helpTopics: true,
  directions: true,
  projectTypes: true,
  updatedAt: true,
  user: { select: { name: true } },
} as const;

/** Карточка попадает в каталог, если заполнен минимум и эксперт её не скрыл */
export const CATALOG_WHERE = {
  cardCompleted: true,
  hiddenByOwner: false,
} as const;

export type CatalogAccess =
  | { ok: true }
  | { ok: false; status: 401 | 403 };

/**
 * Каталог доступен студенту из открытого потока и админу.
 * Эксперту каталог коллег не показываем — у него свой кабинет.
 */
export async function checkCatalogAccess(): Promise<CatalogAccess> {
  const access = await getSpacesAccess();
  if (!access) return { ok: false, status: 401 };
  if (access.expert.state !== "OPEN") return { ok: false, status: 403 };
  if (access.role !== UserRole.STUDENT && access.role !== UserRole.ADMIN) {
    return { ok: false, status: 403 };
  }
  return { ok: true };
}

/** Одна карточка каталога по id — без контактов */
export async function getCatalogCard(id: string) {
  return prisma.expertProfile.findFirst({
    where: { id, ...CATALOG_WHERE },
    select: CATALOG_SELECT,
  });
}
