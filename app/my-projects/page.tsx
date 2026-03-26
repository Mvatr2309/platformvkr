"use client";

import { useState, useEffect } from "react";
import styles from "../projects/projects.module.css";

const TYPE_LABELS: Record<string, string> = {
  CLASSIC_DISSERTATION: "Исследование",
  STARTUP: "Стартап",
  CORPORATE_STARTUP: "Корпоративный стартап",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  OPEN: "Открыт",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершён",
};

interface ProjectCard {
  id: string;
  title: string;
  description: string;
  projectType: string;
  status: string;
  direction: string | null;
  requiredRoles: string[];
  updatedAt: string;
  supervisor: { id: string; user: { name: string } } | null;
  _count: { members: number; applications: number };
}

export default function MyProjectsPage() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects?my=true")
      .then((r) => r.ok ? r.json() : [])
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Мои проекты</h1>
          <a href="/projects/new" className={styles.createButton}>Создать проект</a>
        </div>

        {loading ? (
          <p className={styles.empty}>Загрузка...</p>
        ) : projects.length === 0 ? (
          <p className={styles.empty}>У вас пока нет проектов.</p>
        ) : (
          <div className={styles.list}>
            {projects.map((p) => (
              <a key={p.id} href={`/projects/${p.id}`} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>{p.title}</span>
                  <span className={styles.typeBadge}>
                    {STATUS_LABELS[p.status] || p.status} · {TYPE_LABELS[p.projectType]}
                  </span>
                </div>
                <p className={styles.cardDesc}>
                  {p.description.length > 200 ? p.description.slice(0, 200) + "..." : p.description}
                </p>
                <div className={styles.cardFooter}>
                  {p.supervisor && <span className={styles.supervisor}>Науч. рук.: {p.supervisor.user.name}</span>}
                  {p.direction && <span className={styles.dirBadge}>{p.direction}</span>}
                  <span className={styles.stats}>
                    {p._count.members} участн. · {p._count.applications} заявок
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
