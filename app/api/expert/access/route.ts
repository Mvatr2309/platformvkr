import { NextResponse } from "next/server";
import { getSpacesAccess } from "@/lib/expert-access";

// GET /api/expert/access — состояние плиток пространств для текущего пользователя (08.01, 08.02).
// Используется переключателем в сайдбаре: он должен знать, доступна ли вторая
// плитка, не дублируя логику доступа на клиенте.
export async function GET() {
  const access = await getSpacesAccess();
  if (!access) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  return NextResponse.json({
    role: access.role,
    vkr: access.vkr,
    expert: access.expert,
  });
}
