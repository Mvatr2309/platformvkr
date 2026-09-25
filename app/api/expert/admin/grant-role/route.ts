import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isGuardError } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types/roles";
import { grantExpertRole, mailExpertRoleGranted } from "@/lib/expert-role";

// POST /api/expert/admin/grant-role — админ открывает роль эксперта существующему
// научному руководителю (A2). Второй аккаунт не создаётся: одна почта — обе роли.
// Источник: specs/08-FR-08-requirements-v2.md (A2)
//
// Студенту, внешнему эксперту и админу роль не выдаётся: требование A2 только про
// научников, а внешний эксперт и так эксперт.

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Укажите e-mail" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, role: true, expert: { select: { id: true } } },
  });
  if (!user) {
    return NextResponse.json(
      { error: "Пользователя с таким e-mail нет — пригласите его как внешнего эксперта" },
      { status: 404 }
    );
  }
  if (user.role === UserRole.STUDENT) {
    return NextResponse.json(
      { error: "Это студент платформы — роль эксперта студентам не выдаётся" },
      { status: 409 }
    );
  }
  if (user.role === UserRole.EXPERT) {
    return NextResponse.json({ error: "Это уже внешний эксперт" }, { status: 409 });
  }
  if (user.role !== UserRole.SUPERVISOR) {
    return NextResponse.json(
      { error: "Роль эксперта выдаётся только научным руководителям" },
      { status: 409 }
    );
  }
  if (user.expert) {
    return NextResponse.json({ error: "У этого научного руководителя роль эксперта уже есть" }, { status: 409 });
  }

  const { created, cardCompleted } = await grantExpertRole(user.id);
  if (created) {
    await mailExpertRoleGranted(user.email, user.name, cardCompleted);
  }

  return NextResponse.json({ granted: created, name: user.name, cardCompleted });
}
