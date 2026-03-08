import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/supervisors-list — список всех НР с профилями
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const supervisors = await prisma.user.findMany({
    where: { role: "SUPERVISOR" },
    include: {
      supervisor: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(supervisors);
}
