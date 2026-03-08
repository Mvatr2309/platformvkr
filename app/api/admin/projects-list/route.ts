import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/projects-list — список всех проектов
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    include: {
      supervisor: { include: { user: { select: { name: true } } } },
      _count: { select: { members: true, applications: true } },
    },
    orderBy: { title: "asc" },
  });

  return NextResponse.json(projects);
}
