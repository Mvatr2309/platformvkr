"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import styles from "./sidebar.module.css";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Админ",
  SUPERVISOR: "НР",
  STUDENT: "Студент",
};

export default function AppSidebar({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingAppsCount, setPendingAppsCount] = useState(0);
  const [onboardingDone, setOnboardingDone] = useState(true);

  const user = session?.user;
  const role = user?.role as string | undefined;

  const fetchCounts = useCallback(async () => {
    if (!user || !role) return;
    try {
      const notifRes = await fetch("/api/notifications?limit=1");
      if (notifRes.ok) {
        const data = await notifRes.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch { /* ignore */ }
    try {
      if (role === "SUPERVISOR") {
        const appsRes = await fetch("/api/applications");
        if (appsRes.ok) {
          const apps = await appsRes.json();
          setPendingAppsCount(Array.isArray(apps) ? apps.filter((a: { status: string }) => a.status === "PENDING").length : 0);
        }
      } else if (role === "STUDENT") {
        const authorRes = await fetch("/api/applications?as=author");
        if (authorRes.ok) {
          const authorApps = await authorRes.json();
          setPendingAppsCount(Array.isArray(authorApps) ? authorApps.filter((a: { status: string }) => a.status === "PENDING").length : 0);
        }
      }
    } catch { /* ignore */ }
    // Check onboarding progress
    if (role && role !== "ADMIN") {
      try {
        const obRes = await fetch("/api/onboarding");
        if (obRes.ok) {
          const obData = await obRes.json();
          const steps = obData.steps || [];
          setOnboardingDone(steps.length === 0 || steps.every((s: { done: boolean }) => s.done));
        }
      } catch { /* ignore */ }
    }
  }, [user, role]);

  useEffect(() => {
    if (!user) return;
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [user, fetchCounts]);

  // Don't show sidebar on landing, login, register pages
  if (pathname === "/" || pathname === "/login" || pathname === "/register" || pathname === "/verify-email") {
    return <>{children}</>;
  }

  // Если профиль не заполнен — показываем страницу профиля без сайдбара (как попап)
  // Проверяем и cookie (JWT может быть устаревшим)
  const profileDone = user?.profileCompleted || (typeof document !== "undefined" && document.cookie.includes("profile_completed=1"));
  if (user && !profileDone && (pathname === "/profile" || pathname === "/profile/student")) {
    return <>{children}</>;
  }
  // Admin pages have their own layout
  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  // Not authenticated yet — just show content
  if (!user) {
    return <>{children}</>;
  }

  // Admin on non-admin pages (e.g. /knowledge, /projects/[id]) — full admin sidebar
  if (role === "ADMIN") {
    const adminNav = [
      { href: "/admin/dashboard", label: "Дашборд" },
      { href: "/admin/invitations", label: "Создание аккаунтов" },
      { href: "/admin/students-list", label: "Список студентов" },
      { href: "/admin/supervisors-list", label: "Научные руководители" },
      { href: "/admin/projects", label: "Модерация проектов" },
      { href: "/admin/projects-list", label: "Список проектов" },
      { href: "/admin/calendar", label: "Календарь" },
      { href: "/admin/knowledge-base", label: "База знаний", match: "/knowledge" },
      { href: "/admin/feedback", label: "Обратная связь" },
      { href: "/admin/dictionaries", label: "Справочники" },
    ];
    return (
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.logo}>ВКР</span>
            <span className={styles.badge}>Админ</span>
          </div>
          <nav className={styles.nav}>
            {adminNav.map((item) => {
              const isActive = pathname === item.href
                || pathname.startsWith(item.href + "/")
                || (item.match && (pathname === item.match || pathname.startsWith(item.match + "/")));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <div className={styles.sidebarFooter}>
            <div className={styles.userName}>{user.name}</div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className={styles.logoutBtn}
            >
              Выйти
            </button>
          </div>
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    );
  }

  function navClass(href: string) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return `${styles.navLink} ${active ? styles.navLinkActive : ""}`;
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>ВКР</span>
          <span className={styles.badge}>{ROLE_LABELS[role || ""] || role}</span>
        </div>

        <nav className={styles.nav}>
          {role === "STUDENT" && (
            <>
              <a href="/profile/student" className={navClass("/profile/student")}>Профиль</a>
              <a href="/my-projects" className={navClass("/my-projects")}>Мои проекты</a>
              <a href="/applications" className={navClass("/applications")}>
                Заявки
                {pendingAppsCount > 0 && (
                  <span className={styles.bellBadge}>{pendingAppsCount}</span>
                )}
              </a>
              <div className={styles.divider} />
              <a href="/projects" className={navClass("/projects")}>Проекты</a>
              <a href="/supervisors" className={navClass("/supervisors")} data-onboarding="find-supervisor">Руководители</a>
              <a href="/calendar" className={navClass("/calendar")}>Календарь</a>
              <a href="/knowledge" className={navClass("/knowledge")}>База знаний</a>
            </>
          )}

          {role === "SUPERVISOR" && (
            <>
              <a href="/profile" className={navClass("/profile")} data-onboarding="supervisor-profile">Профиль</a>
              <a href="/my-projects" className={navClass("/my-projects")} data-onboarding="supervisor-projects">Мои проекты</a>
              <a href="/applications" className={navClass("/applications")} data-onboarding="supervisor-applications">
                Заявки
                {pendingAppsCount > 0 && (
                  <span className={styles.bellBadge}>{pendingAppsCount}</span>
                )}
              </a>
              <div className={styles.divider} />
              <a href="/projects" className={navClass("/projects")}>Проекты</a>
              <a href="/calendar" className={navClass("/calendar")}>Календарь</a>
              <a href="/knowledge" className={navClass("/knowledge")}>База знаний</a>
            </>
          )}

          <div className={styles.divider} />
          <a href="/notifications" className={navClass("/notifications")}>
            Уведомления
            {unreadCount > 0 && (
              <span className={styles.bellBadge}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </a>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userName}>{user.name}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className={styles.logoutBtn}
              style={{ flex: 1 }}
            >
              Выйти
            </button>
            {!onboardingDone && (
              <button
                onClick={() => window.dispatchEvent(new Event("onboarding:restart"))}
                className={styles.helpBtn}
                title="Пройти обучение"
              >
                ?
              </button>
            )}
          </div>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
