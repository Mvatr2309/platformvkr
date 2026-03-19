import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

// GET /api/projects/[id]/files — список файлов проекта
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const title = (formData.get("title") as string)?.trim();
    const fileType = formData.get("fileType") as string; // "FILE" or "LINK"

    if (!title) {
      return NextResponse.json({ error: "Укажите название документа" }, { status: 400 });
    }

    // === LINK ===
    if (fileType === "LINK") {
      const url = (formData.get("url") as string)?.trim();
      if (!url) {
        return NextResponse.json({ error: "Укажите ссылку" }, { status: 400 });
      }

      const projectFile = await prisma.projectFile.create({
        data: {
          projectId: id,
          title,
          fileType: "LINK",
          url,
        },
      });

      await prisma.activity.create({
        data: {
          projectId: id,
          action: `Добавлена ссылка: ${title}`,
          actorEmail: session.user.email,
        },
      });

      return NextResponse.json(projectFile, { status: 201 });
    }

    // === FILE (default) ===
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл слишком большой (макс. 10 МБ)" }, { status: 400 });
    }

    // Проверка общего размера файлов проекта (макс. 100 МБ)
    const existingFiles = await prisma.projectFile.findMany({
      where: { projectId: id, fileType: "FILE" },
      select: { filepath: true },
    });
    const fs = await import("fs");
    let totalSize = 0;
    for (const f of existingFiles) {
      if (!f.filepath) continue;
      try {
        const stat = fs.statSync(path.join(process.cwd(), "public", f.filepath));
        totalSize += stat.size;
      } catch { /* файл мог быть удалён */ }
    }
    if (totalSize + file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Превышен лимит хранилища проекта (100 МБ). Удалите ненужные файлы." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "bin";
    const filename = `${id}-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "projects");
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    const filepath = `/uploads/projects/${filename}`;

    const projectFile = await prisma.projectFile.create({
      data: {
        projectId: id,
        title,
        fileType: "FILE",
        filename: file.name,
        filepath,
      },
    });

    await prisma.activity.create({
      data: {
        projectId: id,
        action: `Загружен файл: ${title}`,
        actorEmail: session.user.email,
      },
    });

    return NextResponse.json(projectFile, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/files — удаление файла/ссылки
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const { fileId } = await request.json();

  if (!fileId) {
    return NextResponse.json({ error: "fileId обязателен" }, { status: 400 });
  }

  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId: id },
  });

  if (!file) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  // Удалить физический файл с диска
  if (file.fileType === "FILE" && file.filepath) {
    try {
      await unlink(path.join(process.cwd(), "public", file.filepath));
    } catch { /* файл мог быть уже удалён */ }
  }

  await prisma.projectFile.delete({ where: { id: fileId } });

  await prisma.activity.create({
    data: {
      projectId: id,
      action: `Удалён документ: ${file.title}`,
      actorEmail: session.user.email,
    },
  });

  return NextResponse.json({ ok: true });
}
