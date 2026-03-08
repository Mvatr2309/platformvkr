"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../moderation/moderation.module.css";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "На рассмотрении",
  ACCEPTED: "Принята",
  REJECTED: "Отклонена",
};

interface AppItem {
  id: string;
  motivation: string;
  status: string;
  comment: string | null;
  createdAt: string;
  project: { id: string; title: string };
  student: {
    id: string;
    direction: string;
    course: number;
    competencies: string[];
    portfolioUrl: string | null;
    contact: string;
    user: { name: string };
  };
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const fetchApps = useCallback(async () => {
    const res = await fetch("/api/applications");
    if (res.ok) setApplications(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  if (loading) return <p>Загрузка...</p>;

  const filtered = filter ? applications.filter((a) => a.status === filter) : applications;

  return (
    <div>
      <h1 className={styles.title}>Обзор заявок</h1>
      <p className={styles.subtitle}>
        Всего заявок: {applications.length}
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          onClick={() => setFilter("")}
          style={{ padding: "6px 12px", fontSize: "13px", fontFamily: "inherit", cursor: "pointer", border: !filter ? "2px solid var(--color-deep-blue)" : "1px solid var(--color-border)", background: !filter ? "#EEF2FF" : "var(--color-surface)", fontWeight: 600 }}
        >
          Все ({applications.length})
        </button>
        {Object.entries(STATUS_LABELS).map(([k, v]) => {
          const count = applications.filter((a) => a.status === k).length;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{ padding: "6px 12px", fontSize: "13px", fontFamily: "inherit", cursor: "pointer", border: filter === k ? "2px solid var(--color-deep-blue)" : "1px solid var(--color-border)", background: filter === k ? "#EEF2FF" : "var(--color-surface)", fontWeight: 600 }}
            >
              {v} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length > 0 ? (
        <div className={styles.list}>
          {filtered.map((app) => (
            <div key={app.id} className={styles.card} style={{ cursor: "default" }}>
              <div className={styles.cardHeader}>
                <span className={styles.name}>{app.student.user.name}</span>
                <span className={styles.badge} style={{
                  background: app.status === "PENDING" ? "#FFF3E0" : app.status === "ACCEPTED" ? "#E8F5E9" : "#FFEBEE",
                  color: app.status === "PENDING" ? "#e65100" : app.status === "ACCEPTED" ? "#2a7d2a" : "#c62828",
                }}>
                  {STATUS_LABELS[app.status] || app.status}
                </span>
              </div>
              <div className={styles.cardMeta}>
                <span>Проект: <a href={`/projects/${app.project.id}`} style={{ color: "var(--color-deep-blue)", textDecoration: "none" }}>{app.project.title}</a></span>
                <span>·</span>
                <span>{app.student.direction}, {app.student.course} курс</span>
                <span>·</span>
                <span>Контакт: {app.student.contact}</span>
              </div>

              <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: "8px 0", lineHeight: 1.5 }}>
                <strong>Мотивация:</strong> {app.motivation}
              </p>

              {app.comment && (
                <p style={{ fontSize: "13px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  Комментарий: {app.comment}
                </p>
              )}

              <div className={styles.cardDate}>
                Подана: {new Date(app.createdAt).toLocaleDateString("ru-RU")}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--color-text-muted)" }}>Нет заявок</p>
      )}
    </div>
  );
}
