import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/feedback — список обратной связи (только админ)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const category = request.nextUrl.searchParams.get("category");
  const status = request.nextUrl.searchParams.get("status");

  const where: Record<string, string> = {};
  if (category) where.category = category;
  if (status) where.status = status;

  const feedbacks = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true, role: true } },
    },
  });

  return NextResponse.json(feedbacks);
}

// POST /api/feedback — отправить обратную связь (студент, НР)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["STUDENT", "SUPERVISOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const { category, message } = await request.json();

    if (!category || !message?.trim()) {
      return NextResponse.json({ error: "Выберите категорию и напишите сообщение" }, { status: 400 });
    }

    if (!["BUG", "SUGGESTION", "QUESTION"].includes(category)) {
      return NextResponse.json({ error: "Недопустимая категория" }, { status: 400 });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: session.user.id,
        category,
        message: message.trim(),
      },
    });

    return NextResponse.json(feedback, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка отправки" }, { status: 500 });
  }
}
