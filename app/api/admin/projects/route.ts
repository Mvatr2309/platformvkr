import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/projects — проекты на модерации (PENDING)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

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
