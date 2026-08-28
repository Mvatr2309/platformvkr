import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin, isGuardError } from "@/lib/api-guard";
import { knowledgeVisibilityWhere } from "@/lib/knowledge";

// GET /api/knowledge — список материалов с фильтрами (07.01, 07.02, 07.03).
// Обычный режим — только корневые материалы (главы и страницы книг в каталог не попадают);
// при поиске находятся и страницы внутри книг.
export async function GET(request: NextRequest) {
  const guard = await requireAuth();
  if (isGuardError(guard)) return guard;
  const role = guard.session.user.role;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = { ...knowledgeVisibilityWhere(role) };

  if (category) where.category = category;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  } else {
    where.parentId = null;
  }

  const articles = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      category: true,
      type: true,
      parentId: true,
      visibleToStudents: true,
      visibleToSupervisors: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { files: true, children: true } },
      // Для материалов-файлов — скачивание прямо с карточки списка
      files: { select: { id: true, filename: true }, orderBy: { uploadedAt: "desc" } },
    },
  });

  return NextResponse.json(articles);
}

// POST /api/knowledge — создание материала (07.05): статья, файл, книга,
// а также глава/страница книги (parentId)
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { title, content, category, type, visibleToStudents, visibleToSupervisors, parentId } =
    await request.json();

  if (!title) {
    return NextResponse.json({ error: "Укажите название" }, { status: 400 });
  }

  // Глава или страница внутри книги: категория и видимость наследуются от родителя
  if (parentId) {
    const parent = await prisma.article.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        category: true,
        visibleToStudents: true,
        visibleToSupervisors: true,
        parent: { select: { parentId: true } },
      },
    });
    if (!parent) {
      return NextResponse.json({ error: "Родительский материал не найден" }, { status: 404 });
    }
    // Максимум три уровня: книга → глава → страница
    if (parent.parent?.parentId) {
      return NextResponse.json(
        { error: "Достигнута максимальная вложенность (книга → глава → страница)" },
        { status: 400 }
      );
    }

    const last = await prisma.article.findFirst({
      where: { parentId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const child = await prisma.article.create({
      data: {
        title,
        content: typeof content === "string" ? content : "",
        category: parent.category,
        type: "ARTICLE",
        parentId,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        visibleToStudents: parent.visibleToStudents,
        visibleToSupervisors: parent.visibleToSupervisors,
      },
    });
    return NextResponse.json(child, { status: 201 });
  }

  const materialType = type === "FILE" ? "FILE" : type === "BOOK" ? "BOOK" : "ARTICLE";

  if (!category || (materialType === "ARTICLE" && !content)) {
    return NextResponse.json(
      { error: "Заполните название, содержимое и категорию" },
      { status: 400 }
    );
  }

  const article = await prisma.article.create({
    data: {
      title,
      content: materialType === "FILE" ? "" : content || "",
      category,
      type: materialType,
      visibleToStudents: visibleToStudents !== false,
      visibleToSupervisors: visibleToSupervisors !== false,
    },
  });

  return NextResponse.json(article, { status: 201 });
}
