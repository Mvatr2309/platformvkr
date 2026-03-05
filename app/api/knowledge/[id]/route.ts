import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/knowledge/[id] — детали статьи
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const { title, content, category } = await request.json();

  const article = await prisma.article.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(content && { content }),
      ...(category && { category }),
    },
  });

  return NextResponse.json(article);
}

// DELETE /api/knowledge/[id] — удаление статьи
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.article.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
