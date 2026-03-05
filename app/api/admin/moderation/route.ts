import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/moderation — список профилей на модерации
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const profiles = await prisma.supervisorProfile.findMany({
    where: { status: "PENDING" },
    orderBy: { updatedAt: "asc" },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(profiles);
}
