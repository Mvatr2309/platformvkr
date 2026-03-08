import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOC = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 МБ

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string; // "photo" или "resume"

    if (!file) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Файл слишком большой (макс. 10 МБ)" }, { status: 400 });
    }

    const allowed = type === "photo" ? ALLOWED_IMAGE
      : type === "project" ? [...ALLOWED_IMAGE, ...ALLOWED_DOC]
      : [...ALLOWED_IMAGE, ...ALLOWED_DOC];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Недопустимый формат файла" }, { status: 400 });
    }

    // Генерируем уникальное имя
    const ext = file.name.split(".").pop() || "bin";
    const filename = `${session.user.id}-${type}-${Date.now()}.${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    const url = `/uploads/${filename}`;
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки файла" }, { status: 500 });
  }
}
