import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isGuardError } from "@/lib/api-guard";

// GET /api/admin/supervisors-list — список всех НР с профилями
export async function GET() {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const supervisors = await prisma.user.findMany({
    where: { role: "SUPERVISOR" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      profileCompleted: true,
      createdAt: true,
      updatedAt: true,
      supervisor: true,
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  return NextResponse.json(supervisors);
}
