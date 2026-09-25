import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess, isGuardError } from "@/lib/api-guard";
import { denyVkrClosed } from "@/lib/expert-access";

// GET /api/projects/[id]/activities — лента активности проекта (03.06).
// В ленте почты участников и комментарии модератора, поэтому она, как и карточка
// проекта (C1), только для вошедших. Ленту неоткрытого проекта — черновика, на модерации,
// в работе — видят только участники, научник проекта и админ.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const vkrDenied = await denyVkrClosed();
  if (vkrDenied) return vkrDenied;

  const guard = await requireAuth();
  if (isGuardError(guard)) return guard;

  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { status: true } });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }
  if (project.status !== "OPEN") {
    // Постороннему не подтверждаем, что такой проект есть
    const access = await requireProjectAccess(id);
    if (isGuardError(access)) {
      return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    }
  }

  const activities = await prisma.activity.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(activities);
}
