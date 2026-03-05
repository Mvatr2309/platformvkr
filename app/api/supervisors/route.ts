import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/supervisors — каталог подтверждённых НР с фильтрами и поиском (01.07, 01.09)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const direction = searchParams.get("direction") || "";
  const academicTitle = searchParams.get("academicTitle") || "";
  const recruitment = searchParams.get("recruitment") || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    status: "APPROVED",
  };

  // Фильтр по направлению
  if (direction) {
    where.directions = { has: direction };
  }

  // Фильтр по учёному званию
  if (academicTitle) {
    where.academicTitle = academicTitle;
  }

  // Фильтр по статусу набора
  if (recruitment) {
    where.recruitmentStatus = recruitment;
  }

  // Текстовый поиск по ФИО, месту работы, экспертизе, темам (01.09)
  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { workplace: { contains: search, mode: "insensitive" } },
      { proposedTopics: { contains: search, mode: "insensitive" } },
      { expertise: { has: search } },
    ];
  }

  const profiles = await prisma.supervisorProfile.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { name: true } },
      _count: { select: { projects: true } },
    },
  });

  return NextResponse.json(profiles);
}
