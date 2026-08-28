import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin, isGuardError } from "@/lib/api-guard";
import { isArticleVisible } from "@/lib/knowledge";

// GET /api/knowledge/[id] — детали материала (только авторизованные).
// Для глав/страниц книги видимость проверяется по корню; в ответе — дерево книги для оглавления.
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
      parent: { select: { id: true, parentId: true } },
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
  }

  // Корень дерева: сам материал, его родитель или родитель родителя
  const rootId = article.parent?.parentId ?? article.parent?.id ?? article.id;
  const root =
    rootId === article.id
      ? article
      : await prisma.article.findUnique({ where: { id: rootId } });

  if (!root || !isArticleVisible(guard.session.user.role, root)) {
    return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
  }

  // Оглавление книги — если материал принадлежит книге (или сам является книгой)
  let book = null;
  if (root.type === "BOOK") {
    const chapters = await prisma.article.findMany({
      where: { parentId: root.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        sortOrder: true,
        children: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, title: true, sortOrder: true },
        },
      },
    });
    book = { rootId: root.id, rootTitle: root.title, chapters };
  }

  return NextResponse.json({ ...article, book });
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

  const { title, content, category, visibleToStudents, visibleToSupervisors, sortOrder } =
    await request.json();

  const article = await prisma.article.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(typeof content === "string" && { content }),
      ...(category && { category }),
      ...(typeof visibleToStudents === "boolean" && { visibleToStudents }),
      ...(typeof visibleToSupervisors === "boolean" && { visibleToSupervisors }),
      ...(typeof sortOrder === "number" && { sortOrder }),
    },
  });

  // Видимость и категория книги распространяются на все главы и страницы
  if (
    !article.parentId &&
    (typeof visibleToStudents === "boolean" || typeof visibleToSupervisors === "boolean" || category)
  ) {
    const cascade = {
      ...(typeof visibleToStudents === "boolean" && { visibleToStudents }),
      ...(typeof visibleToSupervisors === "boolean" && { visibleToSupervisors }),
      ...(category && { category }),
    };
    await prisma.article.updateMany({ where: { parentId: id }, data: cascade });
    await prisma.article.updateMany({ where: { parent: { parentId: id } }, data: cascade });
  }

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
