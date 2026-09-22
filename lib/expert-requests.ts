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

/** Статусы, в которых запрос считается необработанным: дубль к тому же эксперту не создаём (08.21) */
export const UNHANDLED_STATUSES = ["NEW", "APPROVED_BY_MODERATOR"] as const;

const platformUrl = () => process.env.NEXTAUTH_URL || "https://vkr-platform.ru";

function mailShell(title: string, body: string, linkPath: string, linkLabel: string) {
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

/** Новый запрос — всем модераторам, то есть всем админам (08.13) */
export async function notifyModerators(requestId: string, studentName: string) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  await notifyMany(
    admins.map((a) => a.id),
    {
      type: "EXPERT_REQUEST_NEW",
      title: "Новый запрос на консультацию",
      message: `${studentName} отправил запрос. Нужна проверка перед передачей эксперту.`,
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
      `<p style="color:#333;font-size:15px;">${studentName} отправил вам запрос на консультацию. Запрос уже проверен модератором.</p>
       <p style="color:#555;font-size:14px;">Откройте анкету и примите решение: принять или отклонить.</p>`,
      "/expert/inbox",
      "Открыть запросы"
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
       <div style="background:#f0f4ff;padding:16px;margin:12px 0;color:#333;">${reason}</div>
       <p style="color:#555;font-size:14px;">Вы можете доработать запрос и отправить его снова.</p>`,
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
      `<p style="color:#333;font-size:15px;"><strong>${params.expertName}</strong> готов вас проконсультировать.</p>
       <div style="background:#f0f4ff;padding:16px;margin:12px 0;color:#333;">
         <strong>Контакт эксперта:</strong> ${params.expertContact}
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
      `<p style="color:#333;font-size:15px;">Студент <strong>${params.studentName}</strong> ждёт вашей консультации.</p>
       <div style="background:#f0f4ff;padding:16px;margin:12px 0;color:#333;">
         <strong>Контакт студента:</strong> ${params.studentContact}
       </div>
       <p style="color:#555;font-size:14px;">Через неделю мы спросим у вас обоих, состоялась ли встреча.</p>`,
      "/expert/inbox",
      "Открыть запросы"
    )
  );
}
