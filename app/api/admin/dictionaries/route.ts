import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/dictionaries — все справочники
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const dictionaries = await prisma.dictionary.findMany({
    include: {
      values: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json(dictionaries);
}

// POST /api/admin/dictionaries — создать/обновить значения справочника
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { type, values } = await request.json();

  if (!type || !Array.isArray(values)) {
    return NextResponse.json({ error: "Укажите type и values" }, { status: 400 });
  }

  // Upsert dictionary
  let dictionary = await prisma.dictionary.findUnique({ where: { type } });

  if (!dictionary) {
    dictionary = await prisma.dictionary.create({ data: { type } });
  }

  // Delete existing values and recreate
  await prisma.dictionaryValue.deleteMany({
    where: { dictionaryId: dictionary.id },
  });

  await prisma.dictionaryValue.createMany({
    data: values.map((v: string, i: number) => ({
      dictionaryId: dictionary.id,
      value: v,
      sortOrder: i,
    })),
  });

  const updated = await prisma.dictionary.findUnique({
    where: { id: dictionary.id },
    include: { values: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(updated);
}
