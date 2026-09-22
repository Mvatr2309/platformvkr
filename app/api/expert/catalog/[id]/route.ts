import { NextResponse } from "next/server";
import { checkCatalogAccess, getCatalogCard } from "@/lib/expert-catalog";

// GET /api/expert/catalog/[id] — одна карточка каталога, без контактов (08.11).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await checkCatalogAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Не авторизован" : "Доступ запрещён" },
      { status: access.status }
    );
  }

  const { id } = await params;
  const card = await getCatalogCard(id);
  if (!card) {
    return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });
  }

  return NextResponse.json(card);
}
