"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./header.module.css";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Админ",
  SUPERVISOR: "НР",
  STUDENT: "Студент",
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef<HTMLDivElement>(null);

  const user = session?.user;
  const role = user?.role as string | undefined;

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch { /* ignore */ }
  }, [user]);

  // Poll notifications every 30 seconds
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    if (bellOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [bellOpen]);

  // Don't show header on landing/login/register pages
  if (pathname === "/" || pathname === "/login" || pathname === "/register") return null;
  // Don't show header inside admin layout (it has its own sidebar)
  if (pathname.startsWith("/admin")) return null;

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function handleNotifClick(notif: Notification) {
    if (!notif.read) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notif.id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setBellOpen(false);
    if (notif.link) {
      window.location.href = notif.link;
    }
  }

  function navClass(href: string) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return `${styles.navLink} ${active ? styles.navLinkActive : ""}`;
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="/" className={styles.logo}>ВКР</a>

        <button
          className={styles.burger}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Меню"
        >
          <span className={styles.burgerIcon} />
        </button>

        <nav className={styles.nav}>
          <a href="/projects" className={navClass("/projects")}>Проекты</a>
          <a href="/supervisors" className={navClass("/supervisors")}>Руководители</a>
          <a href="/calendar" className={navClass("/calendar")}>Календарь</a>
          <a href="/knowledge" className={navClass("/knowledge")}>База знаний</a>

          {role === "STUDENT" && (
            <>
              <span className={styles.divider} />
              <a href="/applications" className={navClass("/applications")}>Мои заявки</a>
              <a href="/profile/student" className={navClass("/profile/student")}>Профиль</a>
            </>
          )}

          {role === "SUPERVISOR" && (
            <>
              <span className={styles.divider} />
              <a href="/applications" className={navClass("/applications")}>Заявки</a>
              <a href="/profile" className={navClass("/profile")}>Профиль</a>
            </>
          )}

          {role === "ADMIN" && (
            <>
              <span className={styles.divider} />
              <a href="/admin" className={navClass("/admin")}>Админка</a>
            </>
          )}
        </nav>

        <div className={styles.right}>
          {status === "loading" ? null : user ? (
            <>
              {/* Notification bell */}
              <div className={styles.bellWrap} ref={bellRef}>
                <button
                  className={styles.bellButton}
                  onClick={() => { setBellOpen(!bellOpen); if (!bellOpen) fetchNotifications(); }}
                  aria-label="Уведомления"
                >
                  🔔
                  {unreadCount > 0 && (
                    <span className={styles.bellBadge}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownHeader}>
                      <span className={styles.dropdownTitle}>Уведомления</span>
                      {unreadCount > 0 && (
                        <button className={styles.markAllBtn} onClick={markAllRead}>
                          Прочитать все
                        </button>
                      )}
                    </div>

                    {notifications.length === 0 ? (
                      <div className={styles.notifEmpty}>Нет уведомлений</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`${styles.notifItem} ${!n.read ? styles.notifUnread : ""}`}
                          onClick={() => handleNotifClick(n)}
                          style={{ cursor: "pointer" }}
                        >
                          <div className={styles.notifTitle}>{n.title}</div>
                          <div className={styles.notifMessage}>{n.message}</div>
                          <div className={styles.notifTime}>{timeAgo(n.createdAt)}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <span className={styles.userName}>{user.name}</span>
              {role && <span className={styles.roleBadge}>{ROLE_LABELS[role] || role}</span>}
              <button onClick={() => signOut({ callbackUrl: "/login" })} className={styles.logoutButton}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <a href="/login" className={styles.authLink}>Войти</a>
              <a href="/register" className={styles.authLink}>Регистрация</a>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMenuOpen(false)}>
          <div className={styles.mobileMenu} onClick={(e) => e.stopPropagation()}>
            <a href="/projects" className={navClass("/projects")}>Проекты</a>
            <a href="/supervisors" className={navClass("/supervisors")}>Руководители</a>
            <a href="/calendar" className={navClass("/calendar")}>Календарь</a>
            <a href="/knowledge" className={navClass("/knowledge")}>База знаний</a>

            {role === "STUDENT" && (
              <>
                <a href="/applications" className={navClass("/applications")}>Мои заявки</a>
                <a href="/profile/student" className={navClass("/profile/student")}>Профиль</a>
              </>
            )}

            {role === "SUPERVISOR" && (
              <>
                <a href="/applications" className={navClass("/applications")}>Заявки</a>
                <a href="/profile" className={navClass("/profile")}>Профиль</a>
              </>
            )}

            {role === "ADMIN" && (
              <a href="/admin" className={navClass("/admin")}>Админка</a>
            )}

            <div className={styles.right}>
              {user ? (
                <>
                  <span className={styles.userName}>{user.name}</span>
                  <button onClick={() => signOut({ callbackUrl: "/login" })} className={styles.logoutButton}>
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <a href="/login" className={styles.authLink}>Войти</a>
                  <a href="/register" className={styles.authLink}>Регистрация</a>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
