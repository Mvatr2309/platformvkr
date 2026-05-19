import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isGuardError } from "@/lib/api-guard";

// GET /api/admin/projects-list — список всех проектов
export async function GET() {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const projects = await prisma.project.findMany({
    include: {
      supervisor: { select: { id: true, user: { select: { name: true } } } },
      _count: { select: { members: true, applications: true } },
    },
    orderBy: { title: "asc" },
    take: 500,
  });

  return NextResponse.json(projects);
}
