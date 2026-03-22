import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/dictionaries?type=directions — публичный доступ к справочникам
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type) {
    const dictionary = await prisma.dictionary.findUnique({
      where: { type },
      include: { values: { orderBy: { sortOrder: "asc" } } },
    });
    if (!dictionary) {
      return NextResponse.json([]);
    }
    return NextResponse.json(dictionary.values.map((v) => v.value));
  }

  // All dictionaries
  const dictionaries = await prisma.dictionary.findMany({
    include: { values: { orderBy: { sortOrder: "asc" } } },
  });

  const result: Record<string, string[]> = {};
  for (const d of dictionaries) {
    result[d.type] = d.values.map((v) => v.value);
  }

  return NextResponse.json(result);
}
