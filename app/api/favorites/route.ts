import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, isGuardError } from "@/lib/api-guard";
import { UserRole } from "@/types/roles";

// Поля карточки НР — те же, что в каталоге /supervisors
const CARD_SELECT = {
  id: true,
  workplace: true,
  position: true,
  academicTitle: true,
  academicDegree: true,
  expertise: true,
  directions: true,
  projectTypes: true,
  maxProjects: true,
  recruitmentStatus: true,
  photoUrl: true,
  user: { select: { name: true } },
  _count: { select: { projects: true } },
} as const;

async function getStudentId(userId: string): Promise<string | null> {
  const student = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return student?.id ?? null;
}

// GET /api/favorites — избранные НР текущего студента
export async function GET() {
  const guard = await requireRole(UserRole.STUDENT);
  if (isGuardError(guard)) return guard;

  const studentId = await getStudentId(guard.session.user.id);
  if (!studentId) return NextResponse.json([]);

  const favorites = await prisma.favoriteSupervisor.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      supervisor: { select: CARD_SELECT },
    },
  });

  // Возвращаем карточки НР (отфильтровываем на случай рассинхрона)
  return NextResponse.json(favorites.map((f) => f.supervisor).filter(Boolean));
}

// POST /api/favorites { supervisorId } — добавить в избранное
export async function POST(request: NextRequest) {
  const guard = await requireRole(UserRole.STUDENT);
  if (isGuardError(guard)) return guard;

  const studentId = await getStudentId(guard.session.user.id);
  if (!studentId) {
    return NextResponse.json({ error: "Профиль студента не найден" }, { status: 400 });
  }

  const { supervisorId } = await request.json().catch(() => ({}));
  if (!supervisorId || typeof supervisorId !== "string") {
    return NextResponse.json({ error: "supervisorId обязателен" }, { status: 400 });
  }

  const supervisor = await prisma.supervisorProfile.findUnique({
    where: { id: supervisorId },
    select: { id: true },
  });
  if (!supervisor) {
    return NextResponse.json({ error: "Руководитель не найден" }, { status: 404 });
  }

  // Идемпотентно: повторное добавление не вызывает ошибку
  await prisma.favoriteSupervisor.upsert({
    where: { studentId_supervisorId: { studentId, supervisorId } },
    create: { studentId, supervisorId },
    update: {},
  });

  return NextResponse.json({ ok: true, favorited: true });
}
