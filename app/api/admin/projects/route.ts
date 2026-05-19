import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isGuardError } from "@/lib/api-guard";

// GET /api/admin/projects — проекты на модерации (PENDING)
export async function GET() {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const projects = await prisma.project.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      supervisor: {
        select: { id: true, user: { select: { name: true } } },
      },
      _count: { select: { members: true, applications: true } },
    },
  });

  return NextResponse.json(projects);
}
