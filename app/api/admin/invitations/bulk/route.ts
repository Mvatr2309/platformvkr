import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { requireAdmin, isGuardError } from "@/lib/api-guard";
import { isStudentEmailAllowed, STUDENT_EMAIL_DOMAIN } from "@/lib/student-email";

function generatePassword(length = 10) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

type ResultItem =
  | { email: string; status: "created"; password: string }
  | { email: string; status: "created_mail_error"; password: string; error: string }
  | { email: string; status: "skipped"; reason: string }
  | { email: string; status: "invalid"; reason: string };

// POST /api/admin/invitations/bulk — массовое создание аккаунтов
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  let body: { emails?: unknown; role?: unknown; cohort?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const rawEmails = Array.isArray(body.emails) ? body.emails : [];
  if (rawEmails.length === 0) {
    return NextResponse.json({ error: "Список адресов пуст" }, { status: 400 });
  }
  if (rawEmails.length > 200) {
    return NextResponse.json({ error: "За один раз — не более 200 адресов" }, { status: 400 });
  }

  const userRole = body.role === "STUDENT" ? "STUDENT" : "SUPERVISOR";
  const cohort = typeof body.cohort === "string" ? body.cohort.trim() : "";

  // Нормализуем + дедуп
  const seen = new Set<string>();
  const queue: { original: string; email: string }[] = [];
  const invalids: ResultItem[] = [];
  for (const raw of rawEmails) {
    const original = String(raw).trim();
    if (!original) continue;
    const normalized = original.toLowerCase();
    if (seen.has(normalized)) {
      invalids.push({ email: original, status: "skipped", reason: "дубль в списке" });
      continue;
    }
    seen.add(normalized);
    if (!EMAIL_RE.test(normalized)) {
      invalids.push({ email: original, status: "invalid", reason: "невалидный e-mail" });
      continue;
    }
    if (userRole === "STUDENT" && !isStudentEmailAllowed(normalized)) {
      invalids.push({ email: original, status: "invalid", reason: `только @${STUDENT_EMAIL_DOMAIN}` });
      continue;
    }
    queue.push({ original, email: normalized });
  }

  const results: ResultItem[] = [...invalids];
  const platformUrl = process.env.NEXTAUTH_URL || "https://vkr-platform.ru";
  const roleLabel = userRole === "SUPERVISOR" ? "научного руководителя" : "студента";

  for (const { email } of queue) {
    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        results.push({ email, status: "skipped", reason: "уже зарегистрирован" });
        continue;
      }
      const existingInvitation = await prisma.invitation.findFirst({
        where: { email, status: "SENT" },
      });
      if (existingInvitation) {
        results.push({ email, status: "skipped", reason: "приглашение уже отправлено" });
        continue;
      }

      const password = generatePassword();
      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: { email, passwordHash, role: userRole, emailVerified: true },
      });

      if (userRole === "STUDENT" && cohort) {
        await prisma.studentProfile.create({
          data: {
            userId: user.id,
            cohort,
            direction: "",
            course: 1,
            competencies: [],
            desiredRoles: [],
            contact: "",
          },
        });
      }

      await prisma.invitation.create({
        data: { email, sentById: guard.session.user.id, status: "ACCEPTED" },
      });

      const html = `
        <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #003092; margin-bottom: 16px;">Добро пожаловать на платформу ВКР</h2>
          <p>Здравствуйте!</p>
          <p>Для вас создан аккаунт ${roleLabel} на платформе управления ВКР.</p>
          <div style="background: #f0f4ff; padding: 20px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Логин:</strong> ${email}</p>
            <p style="margin: 0;"><strong>Пароль:</strong> ${password}</p>
          </div>
          <p>После входа необходимо заполнить профиль — без этого доступ к платформе будет ограничен.</p>
          <p>
            <a href="${platformUrl}/login"
               style="display: inline-block; background: #E8375A; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: 600;">
              Войти на платформу
            </a>
          </p>
        </div>
      `;

      try {
        await sendMail({ to: email, subject: "Доступ к платформе ВКР", html });
        results.push({ email, status: "created", password });
      } catch (mailErr) {
        const errMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
        console.error("Bulk: failed to send invitation email to", email, ":", errMsg);
        results.push({ email, status: "created_mail_error", password, error: errMsg });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Bulk: error processing", email, ":", errMsg);
      results.push({ email, status: "skipped", reason: `ошибка: ${errMsg}` });
    }
  }

  const summary = {
    total: rawEmails.length,
    valid: queue.length,
    created: results.filter((r) => r.status === "created" || r.status === "created_mail_error").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    invalid: results.filter((r) => r.status === "invalid").length,
    mailErrors: results.filter((r) => r.status === "created_mail_error").length,
  };

  return NextResponse.json({ summary, results }, { status: 200 });
}
