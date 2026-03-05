import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/knowledge — список статей с фильтрами (07.01, 07.02, 07.03)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

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
      createdAt: true,
      updatedAt: true,
      _count: { select: { files: true } },
    },
  });

  return NextResponse.json(articles);
}

// POST /api/knowledge — создание статьи (07.05)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { title, content, category } = await request.json();

  if (!title || !content || !category) {
    return NextResponse.json(
      { error: "Заполните название, содержимое и категорию" },
      { status: 400 }
    );
  }

  const article = await prisma.article.create({
    data: { title, content, category },
  });

  return NextResponse.json(article, { status: 201 });
}
