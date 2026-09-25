import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyVkrClosed } from "@/lib/expert-access";

// GET /api/supervisors/[id] — публичная карточка НР (01.08)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const vkrDenied = await denyVkrClosed();
  if (vkrDenied) return vkrDenied;

  const { id } = await params;

  const profile = await prisma.supervisorProfile.findUnique({
    where: { id, status: "APPROVED" },
    include: {
      user: { select: { name: true } },
      projects: {
        where: { status: { in: ["OPEN", "ACTIVE"] } },
        select: {
          id: true,
          title: true,
          projectType: true,
          status: true,
          direction: true,
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
