import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAuth, isGuardError } from "@/lib/api-guard";
import { isInside } from "@/lib/upload-validation";

// Файлы проектов лежат в приватной папке вне public/ и раздаются только через этот роут
const PRIVATE_DIR = path.join(process.cwd(), "uploads", "projects");
// Файлы, загруженные до переноса хранилища из public/
const LEGACY_DIR = path.join(process.cwd(), "public", "uploads", "projects");

// GET /api/projects/[id]/files/[fileId]/download — скачать файл проекта.
// Доступ: админ, любой научный руководитель, студент — только участник проекта.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;

  const guard = await requireAuth();
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: id, student: { userId: session.user.id } },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "Файлы проекта доступны только участникам команды, научным руководителям и администраторам" },
        { status: 403 }
      );
    }
  }

  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId: id, fileType: "FILE" },
    select: { filepath: true, filename: true },
  });
  if (!file?.filepath) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  const rel = file.filepath.replace(/^\/uploads\/projects\//, "");
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
