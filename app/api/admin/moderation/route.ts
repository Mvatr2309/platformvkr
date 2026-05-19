import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isGuardError } from "@/lib/api-guard";

// GET /api/admin/moderation — список профилей на модерации
export async function GET() {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const profiles = await prisma.supervisorProfile.findMany({
    where: { status: "PENDING" },
    orderBy: { updatedAt: "asc" },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(profiles);
}
