import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, isGuardError } from "@/lib/api-guard";
import { UserRole } from "@/types/roles";

// DELETE /api/favorites/[supervisorId] — убрать НР из избранного
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ supervisorId: string }> }
) {
  const guard = await requireRole(UserRole.STUDENT);
  if (isGuardError(guard)) return guard;

  const student = await prisma.studentProfile.findUnique({
    where: { userId: guard.session.user.id },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ ok: true, favorited: false });

  const { supervisorId } = await params;

  // deleteMany — не падает, если записи нет (идемпотентно)
  await prisma.favoriteSupervisor.deleteMany({
    where: { studentId: student.id, supervisorId },
  });

  return NextResponse.json({ ok: true, favorited: false });
}
