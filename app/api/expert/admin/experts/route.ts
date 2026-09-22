import { NextResponse } from "next/server";
import { requireAdmin, isGuardError } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// GET /api/expert/admin/experts — кто есть в разделе и в каком состоянии карточка.
// FR-08 (08.06, 08.08). Контакты экспертов здесь не отдаём: админу для этого
// экрана они не нужны, а лишнее раскрытие контактов раздел не предполагает.
export async function GET() {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const experts = await prisma.expertProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      cardCompleted: true,
      hiddenByOwner: true,
      user: { select: { email: true, name: true, role: true } },
    },
  });

  return NextResponse.json(
    experts.map((e) => ({
      id: e.id,
      email: e.user.email,
      name: e.user.name,
      role: e.user.role,
      cardCompleted: e.cardCompleted,
      hiddenByOwner: e.hiddenByOwner,
    }))
  );
}
