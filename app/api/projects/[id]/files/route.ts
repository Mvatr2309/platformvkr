import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
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

// POST /api/projects/[id]/files — загрузка файла (03.04)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  // Проверяем, что проект существует
  const project = await prisma.project.findUnique({
    where: { id },
    include: { supervisor: { select: { userId: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл слишком большой (макс. 10 МБ)" }, { status: 400 });
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
        filename: file.name,
        filepath,
      },
    });

    // Запись в ленту активности (03.06)
    await prisma.activity.create({
      data: {
        projectId: id,
        action: `Загружен файл: ${file.name}`,
      },
    });

    return NextResponse.json(projectFile, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки файла" }, { status: 500 });
  }
}
