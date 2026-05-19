import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin, isGuardError } from "@/lib/api-guard";

// GET /api/knowledge/[id] — детали статьи (только авторизованные)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth();
  if (isGuardError(guard)) return guard;

  const { id } = await params;

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      files: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
  }

  return NextResponse.json(article);
}

// PUT /api/knowledge/[id] — редактирование статьи (07.05)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { id } = await params;

  const existing = await prisma.article.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
  }

  const { title, content, category } = await request.json();

  const article = await prisma.article.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(content && { content }),
      ...(category && { category }),
    },
  });

  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${id}`);
  return NextResponse.json(article);
}

// DELETE /api/knowledge/[id] — удаление статьи
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { id } = await params;

  const existing = await prisma.article.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
  }

  await prisma.article.delete({ where: { id } });
  revalidatePath("/knowledge");
  return NextResponse.json({ ok: true });
}
