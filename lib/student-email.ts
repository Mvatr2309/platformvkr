// Домен корпоративной почты для студентов. Студенты регистрируются и приглашаются
// только с этой почты; научных руководителей правило не касается.
export const STUDENT_EMAIL_DOMAIN = "phystech.edu";

export function isStudentEmailAllowed(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`);
}

export const STUDENT_EMAIL_ERROR = `Студенты регистрируются только с корпоративной почтой @${STUDENT_EMAIL_DOMAIN}. Проверьте адрес или обратитесь к администратору.`;
