"use client";

import { useState, useEffect, useCallback } from "react";
import Pagination, { usePagination } from "@/components/Pagination";
import styles from "./notifications.module.css";

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { page, setPage, totalPages, paged } = usePagination(notifications, 20);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=50");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Авто-пометка прочитанным при открытии страницы — пользователь увидел уведомления
  useEffect(() => {
    if (loading || unreadCount === 0) return;
    const t = setTimeout(() => {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      }).then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [loading, unreadCount]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function handleClick(notif: Notification) {
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
    if (notif.link) {
      window.location.href = notif.link;
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Уведомления</h1>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className={styles.markAllBtn}>
              Прочитать все ({unreadCount})
            </button>
          )}
        </div>

        {loading ? (
          <p className={styles.empty}>Загрузка...</p>
        ) : notifications.length === 0 ? (
          <p className={styles.empty}>Нет уведомлений</p>
        ) : (
          <>
          <div className={styles.list}>
            {paged.map((n) => (
              <div
                key={n.id}
                className={`${styles.item} ${!n.read ? styles.itemUnread : ""}`}
                onClick={() => handleClick(n)}
                style={{ cursor: n.link ? "pointer" : "default" }}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.itemTitle}>{n.title}</span>
                  <span className={styles.itemTime}>{timeAgo(n.createdAt)}</span>
                </div>
                <div className={styles.itemMessage}>{n.message}</div>
              </div>
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
