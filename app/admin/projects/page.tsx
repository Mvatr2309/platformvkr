"use client";

import { useState, useEffect, useCallback } from "react";
import Pagination, { usePagination } from "@/components/Pagination";
import styles from "../moderation/moderation.module.css";

const TYPE_LABELS: Record<string, string> = {
  CLASSIC_DISSERTATION: "Классическая диссертация",
  STARTUP: "Стартап",
  CORPORATE_STARTUP: "Корпоративный стартап",
};

interface PendingProject {
  id: string;
  title: string;
  description: string;
  projectType: string;
  direction: string | null;
  createdAt: string;
  supervisor: { id: string; user: { name: string } } | null;
  _count: { members: number; applications: number };
}

export default function ProjectModerationPage() {
  const [projects, setProjects] = useState<PendingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comment, setComment] = useState<Record<string, string>>({});

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/admin/projects");
    if (res.ok) setProjects(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment[id] || "" }),
      });
      if (res.ok) fetchProjects();
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  }

  const { page, setPage, totalPages, paged } = usePagination(projects, 20);

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <h1 className={styles.title}>Модерация проектов</h1>
      <p className={styles.subtitle}>
        {projects.length === 0
          ? "Нет проектов, ожидающих модерации"
          : `${projects.length} проект${projects.length === 1 ? "" : projects.length < 5 ? "а" : "ов"} на модерации`}
      </p>

      {projects.length > 0 && (
        <div className={styles.list}>
          {paged.map((p) => (
            <div key={p.id} className={styles.card} style={{ cursor: "default" }}>
              <div className={styles.cardHeader}>
                <a href={`/projects/${p.id}`} className={styles.name} style={{ textDecoration: "none", color: "inherit" }}>
                  {p.title}
                </a>
                <span className={styles.badge}>На модерации</span>
              </div>
              <div className={styles.cardMeta}>
                <span>{TYPE_LABELS[p.projectType]}</span>
                {p.direction && <><span>·</span><span>{p.direction}</span></>}
                {p.supervisor && <><span>·</span><span>Науч. рук.: {p.supervisor.user.name}</span></>}
              </div>
              <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: "8px 0", lineHeight: 1.5 }}>
                {p.description.length > 200 ? p.description.slice(0, 200) + "..." : p.description}
              </p>
              <div className={styles.cardDate}>
                Отправлено: {new Date(p.createdAt).toLocaleDateString("ru-RU")}
              </div>

              <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Комментарий (при отклонении)"
                  value={comment[p.id] || ""}
                  onChange={(e) => setComment({ ...comment, [p.id]: e.target.value })}
                  style={{
                    flex: 1, minWidth: "200px", padding: "6px 8px", fontSize: "13px",
                    border: "1px solid var(--color-border)", fontFamily: "inherit",
                    background: "var(--color-surface)",
                  }}
                />
                <button
                  onClick={() => handleAction(p.id, "approve")}
                  disabled={actionLoading === p.id}
                  style={{
                    background: "var(--color-deep-blue)", color: "#fff", border: "none",
                    padding: "6px 16px", fontSize: "13px", fontWeight: 600,
                    fontFamily: "inherit", cursor: "pointer",
                  }}
                >
                  Одобрить
                </button>
                <button
                  onClick={() => handleAction(p.id, "reject")}
                  disabled={actionLoading === p.id}
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
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
