import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATALOG_SELECT, CATALOG_WHERE, checkCatalogAccess } from "@/lib/expert-catalog";

// GET /api/expert/catalog — каталог экспертов с поиском и фильтром (08.10).
// Контакты в ответ не попадают: см. CATALOG_SELECT.
export async function GET(request: NextRequest) {
  const access = await checkCatalogAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Не авторизован" : "Доступ запрещён" },
      { status: access.status }
    );
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const expertise = searchParams.get("expertise") || "";
  const direction = searchParams.get("direction") || "";
  const projectType = searchParams.get("projectType") || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { ...CATALOG_WHERE };

  if (expertise) where.expertise = { has: expertise };
  if (direction) where.directions = { has: direction };
  if (projectType) where.projectTypes = { has: projectType };

  // Текстовый поиск по ФИО, месту работы, должности и темам — как в каталоге НР
  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { workplace: { contains: search, mode: "insensitive" } },
      { position: { contains: search, mode: "insensitive" } },
      { helpTopics: { contains: search, mode: "insensitive" } },
      { expertise: { has: search } },
    ];
  }

  const [experts, allTags] = await Promise.all([
    prisma.expertProfile.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: CATALOG_SELECT,
    }),
    // Теги для фильтра берём только из карточек, которые реально в каталоге
    prisma.expertProfile.findMany({
      where: CATALOG_WHERE,
      select: { expertise: true },
    }),
  ]);

  const tags = Array.from(new Set(allTags.flatMap((e) => e.expertise))).sort((a, b) =>
    a.localeCompare(b, "ru")
  );

  return NextResponse.json({ experts, tags });
}
