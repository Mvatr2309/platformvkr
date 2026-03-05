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

  const user = session?.user;
  const role = user?.role as string | undefined;

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications?limit=1");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount);
      }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user, fetchUnreadCount]);

  // Don't show sidebar on landing, login, register, admin pages
  if (pathname === "/" || pathname === "/login" || pathname === "/register") {
    return <>{children}</>;
  }
  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  // Not authenticated yet — just show content
  if (!user) {
    return <>{children}</>;
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
          <a href="/projects" className={navClass("/projects")}>Проекты</a>
          {role === "STUDENT" && (
            <a href="/supervisors" className={navClass("/supervisors")}>Руководители</a>
          )}
          <a href="/calendar" className={navClass("/calendar")}>Календарь</a>
          <a href="/knowledge" className={navClass("/knowledge")}>База знаний</a>

          {role === "STUDENT" && (
            <>
              <div className={styles.divider} />
              <a href="/my-projects" className={navClass("/my-projects")}>Мои проекты</a>
              <a href="/applications" className={navClass("/applications")}>Мои заявки</a>
              <a href="/profile/student" className={navClass("/profile/student")}>Профиль</a>
            </>
          )}

          {role === "SUPERVISOR" && (
            <>
              <div className={styles.divider} />
              <a href="/my-projects" className={navClass("/my-projects")}>Мои проекты</a>
              <a href="/applications" className={navClass("/applications")}>Заявки</a>
              <a href="/profile" className={navClass("/profile")}>Профиль</a>
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
