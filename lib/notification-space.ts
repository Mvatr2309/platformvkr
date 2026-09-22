// FR-08: привязка уведомлений к пространству (08.22).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 8.1)
//
// Пространство НЕ хранится в модели Notification — оно вычисляется из типа.
// Поэтому миграция не нужна. Новые типы уведомлений надо относить к пространству
// явно: незнакомый тип попадает в платформу, чтобы уведомление не потерялось.

export type NotificationSpace = "vkr" | "expert";

/** Типы уведомлений экспертной трубы */
export const EXPERT_NOTIFICATION_TYPES = [
  "EXPERT_REQUEST_NEW",
  "EXPERT_REQUEST_APPROVED",
  "EXPERT_REQUEST_REJECTED",
  "EXPERT_REQUEST_ACCEPTED",
  "EXPERT_FEEDBACK_REQUEST",
] as const;

export function parseSpace(value: string | null | undefined): NotificationSpace {
  return value === "expert" ? "expert" : "vkr";
}

export function otherSpace(space: NotificationSpace): NotificationSpace {
  return space === "expert" ? "vkr" : "expert";
}

/** Условие Prisma для выборки уведомлений одного пространства */
export function spaceWhere(space: NotificationSpace) {
  const types = [...EXPERT_NOTIFICATION_TYPES];
  return space === "expert"
    ? { type: { in: types as never } }
    : { type: { notIn: types as never } };
}
