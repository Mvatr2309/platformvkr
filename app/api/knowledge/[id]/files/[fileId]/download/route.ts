import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/api-guard";
import { isInside } from "@/lib/upload-validation";
import { isArticleVisible } from "@/lib/knowledge";

// Файлы базы знаний лежат в приватной папке вне public/ и раздаются только через этот роут
const PRIVATE_DIR = path.join(process.cwd(), "uploads", "knowledge");
// Файлы, загруженные до переноса хранилища из public/
const LEGACY_DIR = path.join(process.cwd(), "public", "uploads", "knowledge");

// GET /api/knowledge/[id]/files/[fileId]/download — скачать файл материала.
// Доступ: по видимости статьи (студенты/НР), админ — всегда.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;

  const guard = await requireAuth();
  if (isGuardError(guard)) return guard;

  const file = await prisma.articleFile.findFirst({
    where: { id: fileId, articleId: id },
    select: {
      filepath: true,
      filename: true,
      article: { select: { visibleToStudents: true, visibleToSupervisors: true } },
    },
  });
  if (!file?.filepath || !isArticleVisible(guard.session.user.role, file.article)) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  const rel = file.filepath.replace(/^\/uploads\/knowledge\//, "");
  let abs = path.join(PRIVATE_DIR, rel);
  if (!isInside(PRIVATE_DIR, abs)) {
    return NextResponse.json({ error: "Недопустимый путь файла" }, { status: 400 });
  }
  try {
    await stat(abs);
  } catch {
    const legacy = path.join(LEGACY_DIR, rel);
    if (!isInside(LEGACY_DIR, legacy)) {
      return NextResponse.json({ error: "Недопустимый путь файла" }, { status: 400 });
    }
    abs = legacy;
  }

  try {
    const buf = await readFile(abs);
    const downloadName = file.filename || rel;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Файл не найден на диске" }, { status: 404 });
  }
}
