import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/students-list — список всех студентов с профилями
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: {
      student: true,
    },
    orderBy: { name: "asc" },
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
