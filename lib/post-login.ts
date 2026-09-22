// FR-08: единая точка правды о том, куда вести пользователя после входа (08.01).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 3.1)
//
// Раньше эта логика была продублирована в app/page.tsx и app/login/page.tsx.
// Используется на клиенте, поэтому без обращений к БД.

/** Страница профиля для роли: у внешнего эксперта «профиль» — это карточка эксперта */
export function profileUrlForRole(role?: string): string {
  if (role === "STUDENT") return "/profile/student";
  if (role === "EXPERT") return "/expert/profile";
  return "/profile";
}

/**
 * Куда вести после успешного входа.
 * Незаполненный профиль вперёд: пока он не заполнен, в обоих пространствах делать нечего.
 * Дальше — экран выбора пространства, включая админа.
 */
export function postLoginUrl(role?: string, profileCompleted?: boolean): string {
  if (role !== "ADMIN" && !profileCompleted) return profileUrlForRole(role);
  return "/spaces";
}
