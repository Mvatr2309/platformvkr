import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/dashboard — сводная статистика для дашборда
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const [
    totalProjects,
    projectsByStatus,
    projectsByType,
    totalSupervisors,
    totalStudents,
    totalApplications,
    pendingModeration,
    pendingProjects,
    upcomingDeadlines,
    studentsByDirection,
    studentsWithoutProject,
    supervisorsWithoutProjects,
    supervisorWorkload,
    recentApplications,
    recentProjects,
    newFeedback,
  ] = await Promise.all([
    prisma.project.count({ where: { status: { not: "DRAFT" } } }),
    prisma.project.groupBy({
      by: ["status"],
      where: { status: { not: "DRAFT" } },
      _count: true,
    }),
    prisma.project.groupBy({
      by: ["projectType"],
      where: { status: { not: "DRAFT" } },
      _count: true,
    }),
    prisma.supervisorProfile.count({ where: { status: "APPROVED" } }),
    prisma.studentProfile.count(),
    prisma.application.count(),
    // Профили НР на модерации
    prisma.supervisorProfile.count({ where: { status: "PENDING" } }),
    // Проекты на модерации
    prisma.project.count({ where: { status: "PENDING" } }),
    // Дедлайны в ближайшие 7 дней
    prisma.event.findMany({
      where: {
        eventType: "DEADLINE",
        date: {
          gte: new Date(),
          lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: { project: { select: { id: true, title: true } } },
      orderBy: { date: "asc" },
    }),
    // Студенты по направлениям
    prisma.studentProfile.groupBy({
      by: ["direction"],
      _count: true,
      orderBy: { _count: { direction: "desc" } },
    }),
    // Студенты без проекта (не являются участниками ни одного проекта)
    prisma.studentProfile.count({
      where: { projects: { none: {} } },
    }),
    // НР без проектов
    prisma.supervisorProfile.count({
      where: { status: "APPROVED", projects: { none: {} } },
    }),
    // Нагрузка НР (топ-10 по количеству проектов)
    prisma.supervisorProfile.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        maxSlots: true,
        user: { select: { name: true } },
        _count: { select: { projects: true } },
      },
      orderBy: { projects: { _count: "desc" } },
      take: 10,
    }),
    // Последние заявки (5 шт)
    prisma.application.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        project: { select: { id: true, title: true } },
        student: { select: { user: { select: { name: true } } } },
        supervisor: { select: { user: { select: { name: true } } } },
      },
    }),
    // Последние проекты (5 шт)
    prisma.project.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        projectType: true,
        status: true,
        createdAt: true,
        supervisor: { select: { user: { select: { name: true } } } },
        _count: { select: { members: true } },
      },
    }),
    // Новые обращения обратной связи
    prisma.feedback.count({ where: { status: "NEW" } }),
  ]);

  // Проекты без руководителя
  const unassignedProjects = await prisma.project.count({
    where: { supervisorId: null, status: { not: "DRAFT" } },
  });

  // НР по типам проектов и магистратурам
  const approvedSupervisors = await prisma.supervisorProfile.findMany({
    where: { status: "APPROVED" },
    select: { projectTypes: true, directions: true },
  });

  const supervisorsByProjectType: Record<string, number> = {
    CLASSIC_DISSERTATION: 0,
    STARTUP: 0,
    CORPORATE_STARTUP: 0,
  };
  for (const sp of approvedSupervisors) {
    for (const t of sp.projectTypes) {
      if (t in supervisorsByProjectType) supervisorsByProjectType[t]++;
    }
  }

  // Все магистратуры из справочника (чтобы показать те, что с 0)
  const directionsDict = await prisma.dictionary.findUnique({
    where: { type: "directions" },
    include: { values: { orderBy: { sortOrder: "asc" } } },
  });
  const directionsList = directionsDict?.values.map((v) => v.value) || [];

  const supervisorsByDirectionCounts: Record<string, number> = {};
  for (const d of directionsList) supervisorsByDirectionCounts[d] = 0;
  for (const sp of approvedSupervisors) {
    for (const d of sp.directions) {
      if (d in supervisorsByDirectionCounts) {
        supervisorsByDirectionCounts[d]++;
      } else {
        // если НР указал направление, которого уже нет в справочнике — всё равно показываем
        supervisorsByDirectionCounts[d] = 1;
      }
    }
  }
  const supervisorsByDirection = Object.entries(supervisorsByDirectionCounts)
    .map(([direction, count]) => ({ direction, count }))
    .sort((a, b) => b.count - a.count);

  // Проекты без участников
  const emptyProjects = await prisma.project.count({
    where: {
      status: { in: ["OPEN", "ACTIVE"] },
      members: { none: {} },
    },
  });

  const statusCounts = Object.fromEntries(
    projectsByStatus.map((s) => [s.status, s._count])
  );

  const typeCounts = Object.fromEntries(
    projectsByType.map((t) => [t.projectType, t._count])
  );

  const directionCounts = studentsByDirection.map((d) => ({
    direction: d.direction,
    count: d._count,
  }));

  return NextResponse.json({
    stats: {
      totalProjects,
      statusCounts,
      typeCounts,
      totalSupervisors,
      totalStudents,
      totalApplications,
      pendingModeration,
      pendingProjects,
      unassignedProjects,
      emptyProjects,
      studentsWithoutProject,
      supervisorsWithoutProjects,
      newFeedback,
    },
    upcomingDeadlines,
    directionCounts,
    supervisorWorkload,
    recentApplications,
    recentProjects,
    supervisorsByProjectType,
    supervisorsByDirection,
  });
}
