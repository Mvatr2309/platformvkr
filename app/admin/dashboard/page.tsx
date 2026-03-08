"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./dashboard.module.css";

interface DashboardData {
  stats: {
    totalProjects: number;
    statusCounts: Record<string, number>;
    totalSupervisors: number;
    totalStudents: number;
    totalApplications: number;
    pendingModeration: number;
    unassignedProjects: number;
    emptyProjects: number;
  };
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    date: string;
    project: { id: string; title: string } | null;
  }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/dashboard");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <p>Загрузка...</p>;
  if (!data) return <p>Ошибка загрузки</p>;

  const { stats, upcomingDeadlines } = data;

  return (
    <div>
      <h1 className={styles.title}>Дашборд</h1>

      {/* Проекты */}
      <h2 className={styles.sectionTitle}>Проекты</h2>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalProjects}</div>
          <div className={styles.statLabel}>Всего</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.statusCounts["OPEN"] || 0}</div>
          <div className={styles.statLabel}>Открытых</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.statusCounts["ACTIVE"] || 0}</div>
          <div className={styles.statLabel}>Активных</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.statusCounts["COMPLETED"] || 0}</div>
          <div className={styles.statLabel}>Завершённых</div>
        </div>
        {stats.unassignedProjects > 0 && (
          <div className={styles.statAlert}>
            <div className={styles.statValue}>{stats.unassignedProjects}</div>
            <div className={styles.statLabel}>Без руководителя</div>
          </div>
        )}
        {stats.emptyProjects > 0 && (
          <div className={styles.statAlert}>
            <div className={styles.statValue}>{stats.emptyProjects}</div>
            <div className={styles.statLabel}>Без участников</div>
          </div>
        )}
      </div>

      {/* Студенты */}
      <h2 className={styles.sectionTitle}>Студенты</h2>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalStudents}</div>
          <div className={styles.statLabel}>Всего студентов</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalApplications}</div>
          <div className={styles.statLabel}>Заявок подано</div>
        </div>
      </div>

      {/* Научные руководители */}
      <h2 className={styles.sectionTitle}>Научные руководители</h2>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalSupervisors}</div>
          <div className={styles.statLabel}>Всего НР</div>
        </div>
      </div>

      {/* Upcoming deadlines */}
      <div className={styles.alertsSection}>
        <h2 className={styles.sectionTitle}>Ближайшие дедлайны (7 дней)</h2>
        {upcomingDeadlines.length === 0 ? (
          <p className={styles.noAlerts}>Нет ближайших дедлайнов</p>
        ) : (
          <div className={styles.alertList}>
            {upcomingDeadlines.map((d) => (
              <div key={d.id} className={styles.alertItem}>
                <span className={styles.alertDate}>
                  {new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </span>
                <span className={styles.alertTitle}>{d.title}</span>
                {d.project && (
                  <a href={`/projects/${d.project.id}`} className={styles.alertProject}>
                    {d.project.title}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
