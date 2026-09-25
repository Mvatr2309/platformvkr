import "server-only";

// Видимость материалов базы знаний по роли. Всё видит только админ, студент и
// научник — по своим флажкам. Остальным, например внешнему эксперту (08.02), не видно
// ничего: по умолчанию закрыто, чтобы новая роль не получила всю базу молча.

// Условие видимости материала базы знаний для роли
export function knowledgeVisibilityWhere(role: string): Record<string, unknown> {
  if (role === "ADMIN") return {};
  if (role === "STUDENT") return { visibleToStudents: true };
  if (role === "SUPERVISOR") return { visibleToSupervisors: true };
  return { id: { in: [] } };
}

// Виден ли конкретный материал пользователю с данной ролью
export function isArticleVisible(
  role: string,
  article: { visibleToStudents: boolean; visibleToSupervisors: boolean }
): boolean {
  if (role === "ADMIN") return true;
  if (role === "STUDENT") return article.visibleToStudents;
  if (role === "SUPERVISOR") return article.visibleToSupervisors;
  return false;
}
