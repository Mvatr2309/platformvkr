import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/dashboard — сводная статистика и список проектов для дашборда
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  // Статистика
  const [
    totalProjects,
    projectsByStatus,
    totalSupervisors,
    totalStudents,
    totalApplications,
    pendingModeration,
    upcomingDeadlines,
  ] = await Promise.all([
    prisma.project.count({ where: { status: { not: "DRAFT" } } }),
    prisma.project.groupBy({
      by: ["status"],
      where: { status: { not: "DRAFT" } },
      _count: true,
    }),
    prisma.supervisorProfile.count({ where: { status: "APPROVED" } }),
    prisma.studentProfile.count(),
    prisma.application.count(),
    prisma.supervisorProfile.count({ where: { status: "PENDING" } }),
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
  ]);

  // Проекты без руководителя (не считая черновики)
  const unassignedProjects = await prisma.project.count({
    where: { supervisorId: null, status: { not: "DRAFT" } },
  });

  // Проекты без участников
  const emptyProjects = await prisma.project.count({
    where: {
      status: { in: ["OPEN", "ACTIVE"] },
      members: { none: {} },
    },
  });

  // Все проекты кроме черновиков
  const projects = await prisma.project.findMany({
    where: { status: { not: "DRAFT" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      projectType: true,
      status: true,
      direction: true,
      createdAt: true,
      supervisor: { select: { user: { select: { name: true } } } },
      _count: { select: { members: true, applications: true } },
    },
  });

  const statusCounts = Object.fromEntries(
    projectsByStatus.map((s) => [s.status, s._count])
  );

  return NextResponse.json({
    stats: {
      totalProjects,
      statusCounts,
      totalSupervisors,
      totalStudents,
      totalApplications,
      pendingModeration,
      unassignedProjects,
      emptyProjects,
    },
    upcomingDeadlines,
    projects,
  });
}
