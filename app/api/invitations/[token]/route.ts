import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// GET /api/invitations/[token] — публичный эндпоинт для получения данных приглашения.
// Защищён rate-limit'ом: 20 запросов / мин / IP. CUID-токены крипто-стойкие, но
// без лимита возможна аномальная нагрузка/сканирование.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(request.headers);
  const { allowed, retryAfterSec } = rateLimit(`invitations:${ip}`, {
    windowMs: 60_000,
    max: 20,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Слишком много запросов. Подождите минуту." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return NextResponse.json(
      { error: "Приглашение не найдено" },
      { status: 404 }
    );
  }

  if (invitation.status !== "SENT") {
    return NextResponse.json(
      { error: "Приглашение уже использовано или истекло" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    name: invitation.name,
    email: invitation.email,
  });
}
