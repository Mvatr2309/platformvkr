import "server-only";

// Условие видимости материала базы знаний для роли (админ видит всё)
export function knowledgeVisibilityWhere(role: string): Record<string, unknown> {
  if (role === "STUDENT") return { visibleToStudents: true };
  if (role === "SUPERVISOR") return { visibleToSupervisors: true };
  return {};
}

// Виден ли конкретный материал пользователю с данной ролью
export function isArticleVisible(
  role: string,
  article: { visibleToStudents: boolean; visibleToSupervisors: boolean }
): boolean {
  if (role === "STUDENT") return article.visibleToStudents;
  if (role === "SUPERVISOR") return article.visibleToSupervisors;
  return true;
}
