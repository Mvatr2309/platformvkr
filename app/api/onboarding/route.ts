import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/onboarding — проверяет прогресс онбординга
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { role, id: userId } = session.user;

  if (role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    // Проект, где студент — автор (isCreator)
    const project = student
      ? await prisma.projectMember.findFirst({
          where: { studentId: student.id, isCreator: true },
          select: {
            projectId: true,
            project: {
              select: {
                id: true,
                projectType: true,
                requiredRoles: true,
                supervisorId: true,
                members: { select: { id: true, isCreator: true } },
              },
            },
          },
        })
      : null;

    const hasProject = !!project;
    const isStartup = project?.project.projectType !== "CLASSIC_DISSERTATION";
    const hasTeam = isStartup
      ? (project?.project.members.filter((m) => !m.isCreator).length ?? 0) > 0
      : true; // для исследований команда не нужна
    const hasSupervisor = !!project?.project.supervisorId;

    return NextResponse.json({
      role: "STUDENT",
      steps: [
        { id: "profile", label: "Заполните профиль", done: true, href: "/profile/student" },
        { id: "project", label: "Создайте проект", done: hasProject, href: "/projects/new" },
        ...(isStartup || !hasProject
          ? [{ id: "team", label: "Добавьте команду", done: hasTeam, href: hasProject ? `/projects/${project!.projectId}` : "/projects/new" }]
          : []),
        { id: "supervisor", label: "Найдите научного руководителя", done: hasSupervisor, href: "/supervisors" },
      ],
    });
  }

  if (role === "SUPERVISOR") {
    const profile = await prisma.supervisorProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });

    const hasProject = profile
      ? (await prisma.project.count({ where: { supervisorId: profile.id } })) > 0
      : false;

    return NextResponse.json({
      role: "SUPERVISOR",
      steps: [
        { id: "profile", label: "Заполните профиль", done: true, href: "/profile" },
        { id: "moderation", label: "Пройдите модерацию", done: profile?.status === "APPROVED", href: "/profile" },
        { id: "projects", label: "Дождитесь предложений или создайте проект", done: hasProject, href: "/my-projects" },
      ],
    });
  }

  return NextResponse.json({ role, steps: [] });
}
