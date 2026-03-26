import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/check-limit — проверка лимита перед созданием проекта
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (session.user.role === "STUDENT") {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (profile) {
      const existing = await prisma.projectMember.findFirst({
        where: { studentId: profile.id, isCreator: true },
      });
      if (existing) {
        return NextResponse.json({
          limitReached: true,
          message: "У вас уже есть проект. Удалите текущий проект, чтобы создать новый.",
        });
      }
    }
  }

  if (session.user.role === "SUPERVISOR") {
    const profile = await prisma.supervisorProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, maxProjects: true },
    });
    if (profile) {
      const count = await prisma.project.count({
        where: { supervisorId: profile.id },
      });
      const max = profile.maxProjects || 4;
      if (count >= max) {
        return NextResponse.json({
          limitReached: true,
          message: `Достигнут лимит проектов (${max}). Измените лимит в профиле или удалите существующий проект.`,
        });
      }
    }
  }

  return NextResponse.json({ limitReached: false });
}
