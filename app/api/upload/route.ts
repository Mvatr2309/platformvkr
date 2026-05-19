import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth, isGuardError } from "@/lib/api-guard";
import { validateUpload, isInside, type UploadKind } from "@/lib/upload-validation";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

// Whitelist допустимых значений параметра `type` и какие правила применяем
const TYPE_TO_KIND: Record<string, UploadKind> = {
  photo: "image",
  resume: "doc",
  project: "doc",
};

export async function POST(request: NextRequest) {
  const guard = await requireAuth();
  if (isGuardError(guard)) return guard;
  const { session } = guard;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const type = String(formData.get("type") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    const kind = TYPE_TO_KIND[type];
    if (!kind) {
      return NextResponse.json(
        { error: "Неизвестный тип загрузки (ожидается photo, resume или project)" },
        { status: 400 }
      );
    }

    const validation = await validateUpload(file, kind);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    await mkdir(UPLOAD_ROOT, { recursive: true });
    const filename = `${session.user.id}-${type}-${validation.value.safeFilename}`;
    const abs = path.join(UPLOAD_ROOT, filename);
    if (!isInside(UPLOAD_ROOT, abs)) {
      return NextResponse.json({ error: "Недопустимый путь файла" }, { status: 400 });
    }
    await writeFile(abs, validation.value.buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки файла" }, { status: 500 });
  }
}
