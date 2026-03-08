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
  projects: Array<{
    id: string;
    title: string;
    projectType: string;
    status: string;
    direction: string | null;
    createdAt: string;
    supervisor: { user: { name: string } } | null;
    _count: { members: number; applications: number };
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "На модерации",
  OPEN: "Открыт",
  ACTIVE: "Активный",
  COMPLETED: "Завершён",
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/dashboard");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <p>Загрузка...</p>;
  if (!data) return <p>Ошибка загрузки</p>;

  const { stats, upcomingDeadlines, projects } = data;

  const filteredProjects = statusFilter
    ? projects.filter((p) => p.status === statusFilter)
    : projects;

  return (
    <div>
      <h1 className={styles.title}>Дашборд проектов</h1>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalProjects}</div>
          <div className={styles.statLabel}>Всего проектов</div>
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
          <div className={styles.statValue}>{stats.totalSupervisors}</div>
          <div className={styles.statLabel}>Руководителей</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalStudents}</div>
          <div className={styles.statLabel}>Студентов</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalApplications}</div>
          <div className={styles.statLabel}>Заявок</div>
        </div>

        {/* Alert stats */}
        {stats.pendingModeration > 0 && (
          <div className={styles.statAlert}>
            <div className={styles.statValue}>{stats.pendingModeration}</div>
            <div className={styles.statLabel}>На модерации</div>
          </div>
        )}
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

      {/* Projects table */}
      <h2 className={styles.sectionTitle}>Все проекты ({filteredProjects.length})</h2>

      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${!statusFilter ? styles.filterBtnActive : ""}`}
          onClick={() => setStatusFilter("")}
        >
          Все
        </button>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <button
            key={k}
            className={`${styles.filterBtn} ${statusFilter === k ? styles.filterBtnActive : ""}`}
            onClick={() => setStatusFilter(k)}
          >
            {v} ({stats.statusCounts[k] || 0})
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Название</th>
              <th>Статус</th>
              <th>Направление</th>
              <th>Руководитель</th>
              <th>Команда</th>
              <th>Заявки</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((p) => (
              <tr key={p.id}>
                <td>
                  <a href={`/projects/${p.id}`} className={styles.projectLink}>{p.title}</a>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${styles[`status_${p.status}`]}`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td>{p.direction || <span className={styles.muted}>—</span>}</td>
                <td>{p.supervisor?.user?.name || <span className={styles.muted}>Нет</span>}</td>
                <td>{p._count.members}</td>
                <td>{p._count.applications}</td>
                <td className={styles.muted}>
                  {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
