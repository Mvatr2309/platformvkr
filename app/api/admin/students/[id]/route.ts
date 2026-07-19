import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isGuardError } from "@/lib/api-guard";

// GET /api/admin/students/[id] — профиль студента с проектами и сокомандниками
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profileCompleted: true,
      createdAt: true,
      student: {
        select: {
          direction: true,
          course: true,
          cohort: true,
          about: true,
          competencies: true,
          desiredRoles: true,
          portfolioUrl: true,
          contact: true,
          projects: {
            orderBy: { joinedAt: "desc" },
            select: {
              role: true,
              isCreator: true,
              joinedAt: true,
              project: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  supervisor: {
                    select: { user: { select: { name: true } } },
                  },
                  members: {
                    select: {
                      studentId: true,
                      role: true,
                      isCreator: true,
                      inSystem: true,
                      manualName: true,
                      manualEmail: true,
                      student: {
                        select: {
                          userId: true,
                          user: { select: { name: true, email: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user || user.role !== "STUDENT") {
    return NextResponse.json({ error: "Студент не найден" }, { status: 404 });
  }

  const projects = (user.student?.projects || []).map((m) => ({
    id: m.project.id,
    title: m.project.title,
    status: m.project.status,
    supervisorName: m.project.supervisor?.user.name || null,
    role: m.isCreator ? "Автор" : m.role || "Участник",
    joinedAt: m.joinedAt,
    teammates: m.project.members
      .filter((tm) => tm.student?.userId !== user.id)
      .map((tm) => ({
        userId: tm.student?.userId || null,
        name: tm.student?.user.name || tm.manualName || "—",
        email: tm.student?.user.email || tm.manualEmail || null,
        role: tm.isCreator ? "Автор" : tm.role || "Участник",
        inSystem: tm.inSystem,
      })),
  }));

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    profileCompleted: user.profileCompleted,
    createdAt: user.createdAt,
    profile: user.student
      ? {
          direction: user.student.direction,
          course: user.student.course,
          cohort: user.student.cohort,
          about: user.student.about,
          competencies: user.student.competencies,
          desiredRoles: user.student.desiredRoles,
          portfolioUrl: user.student.portfolioUrl,
          contact: user.student.contact,
        }
      : null,
    projects,
  });
}
