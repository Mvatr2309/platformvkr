import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isGuardError } from "@/lib/api-guard";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Файлы базы знаний лежат в приватной папке вне public/ и раздаются
// только через download-роут с проверкой роли и видимости статьи
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "knowledge");

// POST /api/knowledge/[id]/files — загрузить файл-шаблон к статье (07.04)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard;

  const { id } = await params;

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const titleRaw = formData.get("title");

  if (!file) {
    return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  }

  // Limit 20MB for templates
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Файл слишком большой (макс. 20МБ)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const filename = `${id}_${Date.now()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await writeFile(filepath, buffer);

  // Отображаемое имя: задаёт админ; по умолчанию — имя загруженного файла.
  // Расширение сохраняем, чтобы файл корректно открывался после скачивания.
  let displayName = typeof titleRaw === "string" ? titleRaw.trim() : "";
  if (!displayName) displayName = file.name;
  else if (ext && !displayName.toLowerCase().endsWith(ext)) displayName += ext;

  const articleFile = await prisma.articleFile.create({
    data: {
      articleId: id,
      filename: displayName,
      filepath: `/uploads/knowledge/${filename}`,
    },
  });

  return NextResponse.json(articleFile, { status: 201 });
}
