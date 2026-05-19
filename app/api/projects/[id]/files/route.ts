import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink, stat } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, isGuardError } from "@/lib/api-guard";
import { validateUpload, isInside } from "@/lib/upload-validation";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const UPLOAD_DIR = path.join(PUBLIC_ROOT, "uploads", "projects");
const PROJECT_QUOTA = 100 * 1024 * 1024;

// GET /api/projects/[id]/files — список файлов проекта (только участники + НР + админ)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireProjectAccess(id);
  if (isGuardError(guard)) return guard;

  const files = await prisma.projectFile.findMany({
    where: { projectId: id },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json(files);
}

// POST /api/projects/[id]/files — создание слота (файл или ссылка)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireProjectAccess(id, { write: true });
  if (isGuardError(guard)) return guard;

  try {
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim().slice(0, 200);
    const fileType = String(formData.get("fileType") ?? "FILE");

    if (!title) {
      return NextResponse.json({ error: "Укажите название документа" }, { status: 400 });
    }

    if (fileType === "LINK") {
      const url = String(formData.get("url") ?? "").trim();
      if (!/^https?:\/\//i.test(url)) {
        return NextResponse.json(
          { error: "Ссылка должна начинаться с http:// или https://" },
          { status: 400 }
        );
      }

      const projectFile = await prisma.projectFile.create({
        data: { projectId: id, title, fileType: "LINK", url },
      });
      await prisma.activity.create({
        data: {
          projectId: id,
          action: `Добавлена ссылка: ${title}`,
          actorEmail: guard.session.user.email,
        },
      });
      revalidatePath(`/projects/${id}`);
      return NextResponse.json(projectFile, { status: 201 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    const validation = await validateUpload(file, "doc");
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Проверка общей квоты проекта (100 МБ)
    const existing = await prisma.projectFile.findMany({
      where: { projectId: id, fileType: "FILE" },
      select: { filepath: true },
    });
    let used = 0;
    for (const f of existing) {
      if (!f.filepath) continue;
      const abs = path.join(PUBLIC_ROOT, f.filepath);
      try {
        const s = await stat(abs);
        used += s.size;
      } catch {
        /* файл мог быть удалён */
      }
    }
    if (used + validation.value.size > PROJECT_QUOTA) {
      return NextResponse.json(
        { error: "Превышен лимит хранилища проекта (100 МБ). Удалите ненужные файлы." },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const absPath = path.join(UPLOAD_DIR, validation.value.safeFilename);
    if (!isInside(UPLOAD_DIR, absPath)) {
      return NextResponse.json({ error: "Недопустимый путь файла" }, { status: 400 });
    }
    await writeFile(absPath, validation.value.buffer);

    const publicPath = `/uploads/projects/${validation.value.safeFilename}`;

    const projectFile = await prisma.projectFile.create({
      data: {
        projectId: id,
        title,
        fileType: "FILE",
        filename: validation.value.originalName,
        filepath: publicPath,
      },
    });

    await prisma.activity.create({
      data: {
        projectId: id,
        action: `Загружен файл: ${title}`,
        actorEmail: guard.session.user.email,
      },
    });

    revalidatePath(`/projects/${id}`);
    return NextResponse.json(projectFile, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/files — удаление файла/ссылки (только админ + НР + автор)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireProjectAccess(id, { write: true });
  if (isGuardError(guard)) return guard;

  const { fileId } = await request.json();
  if (typeof fileId !== "string") {
    return NextResponse.json({ error: "fileId обязателен" }, { status: 400 });
  }

  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId: id },
  });
  if (!file) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  if (file.fileType === "FILE" && file.filepath) {
    const abs = path.join(PUBLIC_ROOT, file.filepath);
    if (isInside(UPLOAD_DIR, abs)) {
      await unlink(abs).catch(() => undefined);
    }
  }

  await prisma.projectFile.delete({ where: { id: fileId } });

  await prisma.activity.create({
    data: {
      projectId: id,
      action: `Удалён документ: ${file.title}`,
      actorEmail: guard.session.user.email,
    },
  });

  revalidatePath(`/projects/${id}`);
  return NextResponse.json({ ok: true });
}
