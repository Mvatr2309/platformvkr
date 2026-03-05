import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Маршруты, доступные только авторизованным
const protectedPaths = [
  "/projects",
  "/supervisors",
  "/applications",
  "/calendar",
  "/knowledge",
  "/profile",
];

// Маршруты, доступные только админам
// Источник: 12-screens-mapping.md
const adminPaths = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;

  // Проверка авторизации для защищённых маршрутов
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isAdmin = adminPaths.some((path) => pathname.startsWith(path));

  if ((isProtected || isAdmin) && !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Проверка роли для админ-маршрутов
  if (isAdmin && user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
