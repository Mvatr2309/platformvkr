import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/feedback/[id] — обновить статус (только админ)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await request.json();

  if (!["NEW", "IN_PROGRESS", "RESOLVED"].includes(status)) {
    return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
  }

  const updated = await prisma.feedback.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updated);
}
