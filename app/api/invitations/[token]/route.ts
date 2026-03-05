import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/invitations/[token] — публичный эндпоинт для получения данных приглашения
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return NextResponse.json(
      { error: "Приглашение не найдено" },
      { status: 404 }
    );
  }

  if (invitation.status !== "SENT") {
    return NextResponse.json(
      { error: "Приглашение уже использовано или истекло" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    name: invitation.name,
    email: invitation.email,
  });
}
