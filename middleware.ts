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
  "/my-projects",
  "/notifications",
];

// Маршруты, доступные только админам
const adminPaths = ["/admin"];

// Маршруты, доступные без заполненного профиля (но с авторизацией)
const profileExemptPaths = ["/profile", "/api/profile", "/api/upload", "/api/auth"];

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

  // Проверка заполненности профиля (не для админов и не для exempt-путей)
  if (user && !user.profileCompleted && user.role !== "ADMIN") {
    // JWT может быть устаревшим — проверяем cookie-флаг (ставится API при сохранении профиля)
    const profileCookie = req.cookies.get("profile_completed")?.value;
    if (profileCookie === "1") {
      return NextResponse.next();
    }

    const isExempt = profileExemptPaths.some((path) => pathname.startsWith(path));
    const isPublic = ["/login", "/register", "/"].includes(pathname);

    if (isProtected && !isExempt && !isPublic) {
      const profileUrl = user.role === "STUDENT" ? "/profile/student" : "/profile";
      return NextResponse.redirect(new URL(profileUrl, req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
