import { NextRequest, NextResponse } from "next/server";
import { requireRole, isGuardError } from "@/lib/api-guard";
import { UserRole } from "@/types/roles";
import { prisma } from "@/lib/prisma";

// GET /api/students/search?q=... — поиск зарегистрированных студентов по имени/почте
// для подбора участников команды. Доступ: студент (автор), НР, админ.
export async function GET(request: NextRequest) {
  const guard = await requireRole(UserRole.STUDENT, UserRole.SUPERVISOR, UserRole.ADMIN);
  if (isGuardError(guard)) return guard;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);

  const students = await prisma.studentProfile.findMany({
    where: {
      user: {
        role: "STUDENT",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
    },
    select: {
      direction: true,
      user: { select: { name: true, email: true } },
    },
    take: 8,
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(
    students.map((s) => ({ name: s.user.name, email: s.user.email, direction: s.direction }))
  );
}
