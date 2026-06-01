import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isGuardError } from "@/lib/api-guard";

// GET /api/admin/accounts?q=...&role=... — поиск аккаунтов по email или ФИО
// Используется в разделе «Удаление аккаунтов».
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const role = searchParams.get("role"); // SUPERVISOR | STUDENT | ADMIN | null (все)

  const where: Record<string, unknown> = {};
  if (role && ["SUPERVISOR", "STUDENT", "ADMIN"].includes(role)) {
    where.role = role;
  }
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      profileCompleted: true,
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    take: 100,
  });

  return NextResponse.json(users);
}
