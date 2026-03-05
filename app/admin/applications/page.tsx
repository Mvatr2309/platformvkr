"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../moderation/moderation.module.css";

interface ModerationApplication {
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
  const [applications, setApplications] = useState<ModerationApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const fetchApps = useCallback(async () => {
    const res = await fetch("/api/applications");
    if (res.ok) setApplications(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comments[id] || "" }),
      });
      if (res.ok) fetchApps();
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  }

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <h1 className={styles.title}>Модерация заявок</h1>
      <p className={styles.subtitle}>
        {applications.length === 0
          ? "Нет заявок, ожидающих модерации"
          : `${applications.length} заяв${applications.length === 1 ? "ка" : applications.length < 5 ? "ки" : "ок"} на модерации`}
      </p>

      {applications.length > 0 && (
        <div className={styles.list}>
          {applications.map((app) => (
            <div key={app.id} className={styles.card} style={{ cursor: "default" }}>
              <div className={styles.cardHeader}>
                <span className={styles.name}>{app.student.user.name}</span>
                <span className={styles.badge}>Одобрена автором</span>
              </div>
              <div className={styles.cardMeta}>
                <span>Проект: <a href={`/projects/${app.project.id}`} style={{ color: "var(--color-deep-blue)", textDecoration: "none" }}>{app.project.title}</a></span>
                <span>·</span>
                <span>{app.student.direction}, {app.student.course} курс</span>
                <span>·</span>
                <span>Контакт: {app.student.contact}</span>
              </div>

              {app.student.competencies.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", margin: "8px 0" }}>
                  {app.student.competencies.slice(0, 8).map((c) => (
                    <span key={c} style={{ fontSize: "11px", padding: "2px 6px", background: "#EEF2FF", color: "var(--color-deep-blue)" }}>{c}</span>
                  ))}
                </div>
              )}

              {app.student.portfolioUrl && (
                <a href={app.student.portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "var(--color-deep-blue)", textDecoration: "none" }}>
                  Портфолио
                </a>
              )}

              <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: "8px 0", lineHeight: 1.5 }}>
                <strong>Мотивация:</strong> {app.motivation}
              </p>

              <div className={styles.cardDate}>
                Подана: {new Date(app.createdAt).toLocaleDateString("ru-RU")}
              </div>

              <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Комментарий (необязательно)"
                  value={comments[app.id] || ""}
                  onChange={(e) => setComments({ ...comments, [app.id]: e.target.value })}
                  style={{
                    flex: 1, minWidth: "200px", padding: "6px 8px", fontSize: "13px",
                    border: "1px solid var(--color-border)", fontFamily: "inherit",
                    background: "var(--color-surface)",
                  }}
                />
                <button
                  onClick={() => handleAction(app.id, "approve")}
                  disabled={actionLoading === app.id}
                  style={{
                    background: "var(--color-deep-blue)", color: "#fff", border: "none",
                    padding: "6px 16px", fontSize: "13px", fontWeight: 600,
                    fontFamily: "inherit", cursor: "pointer",
                  }}
                >
                  Одобрить
                </button>
                <button
                  onClick={() => handleAction(app.id, "reject")}
                  disabled={actionLoading === app.id}
                  style={{
                    background: "transparent", color: "var(--color-coral)",
                    border: "2px solid var(--color-coral)", padding: "4px 16px",
                    fontSize: "13px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                  }}
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
