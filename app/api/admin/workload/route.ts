import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/workload — нагрузка НР: список всех approved НР с проектами/максимумом
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const supervisors = await prisma.supervisorProfile.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      maxSlots: true,
      maxProjects: true,
      workplace: true,
      position: true,
      contact: true,
      directions: true,
      projectTypes: true,
      recruitmentStatus: true,
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { projects: true } },
    },
    orderBy: { projects: { _count: "desc" } },
  });

  return NextResponse.json(supervisors);
}
