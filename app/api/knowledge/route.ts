import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin, isGuardError } from "@/lib/api-guard";
import { knowledgeVisibilityWhere } from "@/lib/knowledge";

// GET /api/knowledge — список статей с фильтрами (07.01, 07.02, 07.03)
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
  }

  const articles = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      category: true,
      type: true,
      visibleToStudents: true,
      visibleToSupervisors: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { files: true } },
      // Для материалов-файлов — скачивание прямо с карточки списка
      files: { select: { id: true, filename: true }, orderBy: { uploadedAt: "desc" } },
    },
  });

  return NextResponse.json(articles);
}

// POST /api/knowledge — создание материала (07.05): статья или файл
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { title, content, category, type, visibleToStudents, visibleToSupervisors } =
    await request.json();

  const materialType = type === "FILE" ? "FILE" : "ARTICLE";

  if (!title || !category || (materialType === "ARTICLE" && !content)) {
    return NextResponse.json(
      { error: "Заполните название, содержимое и категорию" },
      { status: 400 }
    );
  }

  const article = await prisma.article.create({
    data: {
      title,
      content: materialType === "ARTICLE" ? content : "",
      category,
      type: materialType,
      visibleToStudents: visibleToStudents !== false,
      visibleToSupervisors: visibleToSupervisors !== false,
    },
  });

  return NextResponse.json(article, { status: 201 });
}
