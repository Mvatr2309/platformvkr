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
                status: true,
                requiredRoles: true,
                supervisorId: true,
                members: { select: { id: true, isCreator: true } },
              },
            },
          },
        })
      : null;

    const hasProject = !!project;
    const isStartup = hasProject && project.project.projectType !== "CLASSIC_DISSERTATION";
    const hasTeam = isStartup
      ? (project.project.members.filter((m) => !m.isCreator).length ?? 0) > 0
      : true; // для исследований команда не нужна
    const projectStatus = project?.project.status;
    const projectSubmitted = hasProject && projectStatus !== "DRAFT"; // отправлен на модерацию или дальше
    const projectApproved = hasProject && (projectStatus === "OPEN" || projectStatus === "ACTIVE" || projectStatus === "COMPLETED");
    const hasSupervisor = !!project?.project.supervisorId;

    // Заявка на НР считается тоже — шаг завершён если есть НР или отправлена заявка
    const hasSupervisorRequest = hasProject
      ? (await prisma.application.count({
          where: { projectId: project.projectId, type: "SUPERVISION_REQUEST" },
        })) > 0
      : false;
    const supervisorStepDone = hasSupervisor || hasSupervisorRequest;

    return NextResponse.json({
      role: "STUDENT",
      steps: [
        { id: "profile", label: "Заполните профиль", done: true, href: "/profile/student" },
        { id: "project", label: "Создайте проект", done: hasProject, href: "/projects/new" },
        ...(isStartup
          ? [{ id: "team", label: "Добавьте команду", done: hasTeam, href: `/projects/${project!.projectId}` }]
          : []),
        { id: "submit", label: "Отправьте проект на модерацию", done: projectSubmitted, href: hasProject ? `/projects/${project!.projectId}` : "/my-projects" },
        { id: "moderation", label: "Дождитесь одобрения модератором", done: projectApproved, href: hasProject ? `/projects/${project!.projectId}` : "/my-projects" },
        { id: "supervisor", label: "Найдите научного руководителя", done: supervisorStepDone, href: "/supervisors" },
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
        { id: "supervisor_moderation", label: "Пройдите модерацию", done: profile?.status === "APPROVED", href: "/profile" },
        { id: "projects", label: "Дождитесь предложений или создайте проект", done: hasProject, href: "/my-projects" },
      ],
    });
  }

  return NextResponse.json({ role, steps: [] });
}
