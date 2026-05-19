import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isGuardError } from "@/lib/api-guard";

// GET /api/admin/students-list — список всех студентов с профилями
export async function GET() {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      email: true,
      name: true,
      profileCompleted: true,
      student: true,
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  const registered = students.map((s) => ({
    id: s.id,
    email: s.email,
    name: s.name,
    profileCompleted: s.profileCompleted,
    inSystem: true,
    student: s.student,
  }));

  // Ручные участники (добавлены через карточку проекта, без аккаунта)
  const manualMembers = await prisma.projectMember.findMany({
    where: { inSystem: false, studentId: null },
    select: {
      id: true,
      manualName: true,
      manualEmail: true,
      manualDirection: true,
      role: true,
      project: { select: { title: true } },
    },
    take: 500,
  });

  const manual = manualMembers.map((m) => ({
    id: `manual_${m.id}`,
    memberId: m.id,
    email: m.manualEmail || "—",
    name: m.manualName || "—",
    profileCompleted: false,
    inSystem: false,
    student: m.manualDirection ? { direction: m.manualDirection, course: null, cohort: null, contact: m.manualEmail || null, competencies: [] } : null,
    projectInfo: m.role ? `${m.role} — ${m.project.title}` : m.project.title,
  }));

  return NextResponse.json([...registered, ...manual]);
}
