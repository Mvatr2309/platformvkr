import "server-only";
import path from "path";
import crypto from "crypto";

const PROFILE = {
  doc: {
    mime: new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "application/zip",
    ]),
    ext: new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".zip"]),
    maxBytes: 10 * 1024 * 1024,
  },
  image: {
    mime: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    ext: new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]),
    maxBytes: 5 * 1024 * 1024,
  },
} as const;

export type UploadKind = keyof typeof PROFILE;

export type ValidatedUpload = {
  safeFilename: string;
  ext: string;
  originalName: string;
  buffer: Buffer;
  size: number;
};

export type ValidationResult =
  | { ok: true; value: ValidatedUpload }
  | { ok: false; error: string };

export async function validateUpload(
  file: File,
  kind: UploadKind
): Promise<ValidationResult> {
  const rules = PROFILE[kind];

  if (file.size === 0) return { ok: false, error: "Пустой файл" };
  if (file.size > rules.maxBytes) {
    const mb = Math.round(rules.maxBytes / 1024 / 1024);
    return { ok: false, error: `Файл больше лимита (${mb} МБ)` };
  }
  if (!rules.mime.has(file.type)) {
    return { ok: false, error: `Недопустимый MIME-тип: ${file.type || "unknown"}` };
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!rules.ext.has(ext)) {
    return { ok: false, error: `Недопустимое расширение: ${ext || "(нет)"}` };
  }

  const baseRaw = path.basename(file.name, ext);
  const safeBase = baseRaw.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120);
  const originalName = `${safeBase || "file"}${ext}`;
  const safeFilename = `${crypto.randomUUID()}${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    ok: true,
    value: { safeFilename, ext, originalName, buffer, size: file.size },
  };
}

export function isInside(parent: string, target: string): boolean {
  const rel = path.relative(parent, target);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}
