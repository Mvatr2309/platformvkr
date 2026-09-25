import "server-only";
import { prisma } from "@/lib/prisma";
import { notify, notifyMany } from "@/lib/notify";
import { sendMail } from "@/lib/mail";

// FR-08: общие правила работы с запросами на консультацию.
// Источник: specs/08-FR-08-expert-pipeline.md (разделы 5.3, 6, 8)

/** Пороги длины полей анкеты (08.12) */
export const MIN_TOPIC = 500;
export const MIN_RESULT = 80;
export const MIN_PROGRESS = 500;

/**
 * Статусы, в которых запрос считается необработанным: дубль к тому же эксперту не создаём (08.21).
 * Запрос на доработке тоже в их числе — студент исправляет его, а не заводит новый (M1).
 */
export const UNHANDLED_STATUSES = ["NEW", "NEEDS_REVISION", "APPROVED_BY_MODERATOR"] as const;

/**
 * Что видит эксперт во входящих. Явный список, а не «всё, кроме»: запросы на модерации
 * и на доработке эксперту не видны (08.14, M1), и новый статус не должен открыться
 * ему случайно.
 */
export const EXPERT_VISIBLE_STATUSES = [
  "APPROVED_BY_MODERATOR",
  "REJECTED_BY_EXPERT",
  "CONTACTS_SENT",
  "AWAITING_FEEDBACK",
  "CLOSED",
] as const;

export type RequestFormFields = {
  topic: string;
  expectedResult: string;
  ownProgress: string;
  problemArea: string | null;
  materialsUrl: string | null;
  projectId: string | null;
};

/**
 * Разбор и проверка анкеты запроса (08.12). Общая для отправки и для повторной
 * отправки после доработки (M1), чтобы пороги не разошлись.
 */
export function parseRequestForm(
  data: Record<string, unknown>
): { error: string } | { fields: RequestFormFields } {
  const topic = String(data.topic || "").trim();
  const expectedResult = String(data.expectedResult || "").trim();
  const ownProgress = String(data.ownProgress || "").trim();
  const problemArea = String(data.problemArea || "").trim();
  const materialsUrl = String(data.materialsUrl || "").trim();

  if (topic.length < MIN_TOPIC) {
    return { error: `Опишите вопрос подробнее — минимум ${MIN_TOPIC} символов` };
  }
  if (expectedResult.length < MIN_RESULT) {
    return { error: `Опишите ожидаемый результат — минимум ${MIN_RESULT} символов` };
  }
  if (ownProgress.length < MIN_PROGRESS) {
    return { error: `Расскажите, что уже сделали сами — минимум ${MIN_PROGRESS} символов` };
  }

  return {
    fields: {
      topic,
      expectedResult,
      ownProgress,
      problemArea: problemArea || null,
      materialsUrl: materialsUrl || null,
      projectId: data.projectId ? String(data.projectId) : null,
    },
  };
}

/** Проект к запросу можно приложить только свой — чужой молча отбрасываем */
export async function ownProjectOrNull(projectId: string | null, studentId: string) {
  if (!projectId) return null;
  const member = await prisma.projectMember.findFirst({
    where: { projectId, studentId },
    select: { id: true },
  });
  return member ? projectId : null;
}

/**
 * Текст пользователя в HTML письма — экранируем, чтобы он не стал разметкой.
 * Любая подстановка ФИО, контакта, причины или комментария в письмо идёт через него:
 * иначе эксперт или студент вставит ссылку в официальное письмо платформы.
 */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const platformUrl = () => process.env.NEXTAUTH_URL || "https://vkr-platform.ru";

/** Оболочка писем трубы: заголовок, текст и кнопка со ссылкой внутрь платформы */
export function mailShell(title: string, body: string, linkPath: string, linkLabel: string) {
  return `
    <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #003092; margin-bottom: 16px;">${title}</h2>
      ${body}
      <p style="margin-top: 24px;">
        <a href="${platformUrl()}${linkPath}"
           style="display: inline-block; background: #E8375A; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: 600;">
          ${linkLabel}
        </a>
      </p>
    </div>
  `;
}

/** Письмо отправляем «мягко»: сбой почты не должен ронять переход по статусу */
export async function safeMail(to: string, subject: string, html: string) {
  try {
    await sendMail({ to, subject, html });
  } catch (err) {
    console.error("[expert-requests] не удалось отправить письмо на", to, err);
  }
}

/**
 * Новый запрос — всем модераторам, то есть всем админам (08.13).
 * Исправленный после доработки запрос возвращается в ту же очередь (M1).
 */
export async function notifyModerators(
  requestId: string,
  studentName: string,
  opts: { resubmitted?: boolean } = {}
) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  await notifyMany(
    admins.map((a) => a.id),
    {
      type: "EXPERT_REQUEST_NEW",
      title: opts.resubmitted ? "Запрос исправлен после доработки" : "Новый запрос на консультацию",
      message: opts.resubmitted
        ? `${studentName} исправил запрос по вашему комментарию. Нужна повторная проверка.`
        : `${studentName} отправил запрос. Нужна проверка перед передачей эксперту.`,
      link: `/expert/admin/requests`,
    }
  );
}

/** Запрос одобрен модератором — эксперту (08.14) */
export async function notifyExpertApproved(
  expertUserId: string,
  expertEmail: string,
  studentName: string
) {
  await notify({
    userId: expertUserId,
    type: "EXPERT_REQUEST_APPROVED",
    title: "Новый запрос на консультацию",
    message: `${studentName} просит консультацию. Посмотрите анкету и примите решение.`,
    link: "/expert/inbox",
  });
  await safeMail(
    expertEmail,
    "Новый запрос на консультацию",
    mailShell(
      "Новый запрос на консультацию",
      `<p style="color:#333;font-size:15px;">${escapeHtml(studentName)} отправил вам запрос на консультацию. Запрос уже проверен модератором.</p>
       <p style="color:#555;font-size:14px;">Откройте анкету и примите решение: принять или отклонить.</p>`,
      "/expert/inbox",
      "Открыть запросы"
    )
  );
}

/** Возврат на доработку — студенту, с комментарием модератора (M1) */
export async function notifyStudentReturned(
  studentUserId: string,
  studentEmail: string,
  comment: string
) {
  await notify({
    userId: studentUserId,
    type: "EXPERT_REQUEST_RETURNED",
    title: "Запрос вернули на доработку",
    message: comment,
    link: "/expert/my-requests",
  });
  await safeMail(
    studentEmail,
    "Запрос на консультацию вернули на доработку",
    mailShell(
      "Запрос вернули на доработку",
      `<p style="color:#333;font-size:15px;">Модератор проверил ваш запрос и просит его дополнить:</p>
       <div style="background:#f0f4ff;padding:16px;margin:12px 0;color:#333;white-space:pre-line;">${escapeHtml(comment)}</div>
       <p style="color:#555;font-size:14px;">Исправьте запрос и отправьте его снова — он вернётся на проверку. Эксперт увидит запрос после одобрения.</p>`,
      "/expert/my-requests",
      "Исправить запрос"
    )
  );
}

/** Отказ — студенту, с причиной (08.13, 08.14) */
export async function notifyStudentRejected(
  studentUserId: string,
  studentEmail: string,
  byWhom: "модератором" | "экспертом",
  reason: string
) {
  await notify({
    userId: studentUserId,
    type: "EXPERT_REQUEST_REJECTED",
    title: `Запрос отклонён ${byWhom}`,
    message: reason,
    link: "/expert/my-requests",
  });
  await safeMail(
    studentEmail,
    `Запрос на консультацию отклонён ${byWhom}`,
    mailShell(
      `Запрос отклонён ${byWhom}`,
      `<p style="color:#333;font-size:15px;">Причина:</p>
       <div style="background:#f0f4ff;padding:16px;margin:12px 0;color:#333;white-space:pre-line;">${escapeHtml(reason)}</div>
       <p style="color:#555;font-size:14px;">${
         byWhom === "модератором"
           ? "Если вопрос остаётся, отправьте новый запрос с учётом причины."
           : "Можно выбрать другого эксперта в каталоге или написать этому эксперту позже."
       }</p>`,
      "/expert/my-requests",
      "Мои запросы"
    )
  );
}

/**
 * Запрос принят — обмен контактами (08.15).
 * Студенту уходит контакт эксперта, эксперту — контакт студента.
 * До этого момента ни одна сторона контактов другой не видит.
 */
export async function notifyContactsExchanged(params: {
  studentUserId: string;
  studentEmail: string;
  studentName: string;
  studentContact: string;
  expertUserId: string;
  expertEmail: string;
  expertName: string;
  expertContact: string;
}) {
  await notify({
    userId: params.studentUserId,
    type: "EXPERT_REQUEST_ACCEPTED",
    title: "Запрос принят",
    message: `${params.expertName} принял ваш запрос. Контакт: ${params.expertContact}`,
    link: "/expert/my-requests",
  });
  await safeMail(
    params.studentEmail,
    "Эксперт принял ваш запрос",
    mailShell(
      "Эксперт принял ваш запрос",
      `<p style="color:#333;font-size:15px;"><strong>${escapeHtml(params.expertName)}</strong> готов вас проконсультировать.</p>
       <div style="background:#f0f4ff;padding:16px;margin:12px 0;color:#333;">
         <strong>Контакт эксперта:</strong> ${escapeHtml(params.expertContact)}
       </div>
       <p style="color:#555;font-size:14px;">Напишите первым и договоритесь о времени. Через неделю мы спросим, как прошла встреча.</p>`,
      "/expert/my-requests",
      "Мои запросы"
    )
  );

  await notify({
    userId: params.expertUserId,
    type: "EXPERT_REQUEST_ACCEPTED",
    title: "Вы приняли запрос",
    message: `Контакт студента ${params.studentName}: ${params.studentContact}`,
    link: "/expert/inbox",
  });
  await safeMail(
    params.expertEmail,
    "Контакты студента",
    mailShell(
      "Вы приняли запрос",
      `<p style="color:#333;font-size:15px;">Студент <strong>${escapeHtml(params.studentName)}</strong> ждёт вашей консультации.</p>
       <div style="background:#f0f4ff;padding:16px;margin:12px 0;color:#333;">
         <strong>Контакт студента:</strong> ${escapeHtml(params.studentContact)}
       </div>
       <p style="color:#555;font-size:14px;">Через неделю мы спросим у вас обоих, состоялась ли встреча.</p>`,
      "/expert/inbox",
      "Открыть запросы"
    )
  );
}
