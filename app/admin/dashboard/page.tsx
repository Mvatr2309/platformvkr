"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./dashboard.module.css";

const TYPE_LABELS: Record<string, string> = {
  CLASSIC_DISSERTATION: "Исследование",
  STARTUP: "Стартап",
  CORPORATE_STARTUP: "Корп. стартап",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "На модерации",
  OPEN: "Открыт",
  ACTIVE: "Активный",
  COMPLETED: "Завершён",
};

const APP_TYPE_LABELS: Record<string, string> = {
  STUDENT: "Студент → проект",
  SUPERVISOR: "НР → проект",
  SUPERVISION_REQUEST: "Студент → НР",
};

const APP_STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает",
  APPROVED_BY_AUTHOR: "Одобрена автором",
  ACCEPTED: "Принята",
  REJECTED: "Отклонена",
  INTERESTED: "Заинтересован",
  CONFIRMED: "Подтверждена",
  DECLINED: "Отклонена НР",
};

interface DashboardData {
  stats: {
    totalProjects: number;
    statusCounts: Record<string, number>;
    typeCounts: Record<string, number>;
    totalSupervisors: number;
    totalStudents: number;
    totalApplications: number;
    pendingModeration: number;
    pendingProjects: number;
    unassignedProjects: number;
    emptyProjects: number;
    studentsWithoutProject: number;
    supervisorsWithoutProjects: number;
    newFeedback: number;
  };
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    date: string;
    project: { id: string; title: string } | null;
  }>;
  directionCounts: Array<{ direction: string; count: number }>;
  supervisorWorkload: Array<{
    id: string;
    maxSlots: number;
    user: { name: string };
    _count: { projects: number };
  }>;
  recentApplications: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
    project: { id: string; title: string };
    student: { user: { name: string } } | null;
    supervisor: { user: { name: string } } | null;
  }>;
  recentProjects: Array<{
    id: string;
    title: string;
    projectType: string;
    status: string;
    createdAt: string;
    supervisor: { user: { name: string } } | null;
    _count: { members: number };
  }>;
  supervisorsByProjectType: Record<string, number>;
  supervisorsByDirection: Array<{ direction: string; count: number }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [workloadPage, setWorkloadPage] = useState(1);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/dashboard");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <p>Загрузка...</p>;
  if (!data) return <p>Ошибка загрузки</p>;

  const { stats, upcomingDeadlines, directionCounts, supervisorWorkload, recentApplications, recentProjects, supervisorsByProjectType, supervisorsByDirection } = data;

  const supTypeOrdered: Array<{ key: string; label: string; count: number }> = [
    { key: "CLASSIC_DISSERTATION", label: "Исследование", count: supervisorsByProjectType.CLASSIC_DISSERTATION || 0 },
    { key: "STARTUP", label: "Стартап", count: supervisorsByProjectType.STARTUP || 0 },
    { key: "CORPORATE_STARTUP", label: "Корп. стартап", count: supervisorsByProjectType.CORPORATE_STARTUP || 0 },
  ];
  const maxSupType = Math.max(...supTypeOrdered.map((s) => s.count), 1);
  const maxSupDir = Math.max(...supervisorsByDirection.map((s) => s.count), 1);

  const hasAlerts = stats.pendingModeration > 0 || stats.pendingProjects > 0 ||
    stats.studentsWithoutProject > 0 || stats.unassignedProjects > 0 ||
    stats.emptyProjects > 0 || stats.newFeedback > 0;

  return (
    <div>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Дашборд</h1>
        <div className={styles.quickActions}>
          <Link href="/admin/invitations" className={styles.quickBtn}>+ Создать аккаунт</Link>
          <Link href="/admin/projects" className={styles.quickBtn}>Модерация</Link>
          <Link href="/admin/calendar" className={styles.quickBtn}>Календарь</Link>
        </div>
      </div>

      {/* Требует внимания */}
      {hasAlerts && (
        <>
          <h2 className={styles.sectionTitle}>Требует внимания</h2>
          <div className={styles.statsRow}>
            {stats.pendingProjects > 0 && (
              <Link href="/admin/projects" className={styles.statAlert}>
                <div className={styles.statValue}>{stats.pendingProjects}</div>
                <div className={styles.statLabel}>Проектов на модерации</div>
              </Link>
            )}
            {stats.pendingModeration > 0 && (
              <Link href="/admin/supervisors-list" className={styles.statAlert}>
                <div className={styles.statValue}>{stats.pendingModeration}</div>
                <div className={styles.statLabel}>Профилей НР на модерации</div>
              </Link>
            )}
            {stats.unassignedProjects > 0 && (
              <Link href="/admin/projects-list" className={styles.statAlert}>
                <div className={styles.statValue}>{stats.unassignedProjects}</div>
                <div className={styles.statLabel}>Проектов без НР</div>
              </Link>
            )}
            {stats.studentsWithoutProject > 0 && (
              <Link href="/admin/students-list" className={styles.statAlert}>
                <div className={styles.statValue}>{stats.studentsWithoutProject}</div>
                <div className={styles.statLabel}>Студентов без проекта</div>
              </Link>
            )}
            {stats.emptyProjects > 0 && (
              <Link href="/admin/projects-list" className={styles.statAlert}>
                <div className={styles.statValue}>{stats.emptyProjects}</div>
                <div className={styles.statLabel}>Проектов без участников</div>
              </Link>
            )}
            {stats.newFeedback > 0 && (
              <Link href="/admin/feedback" className={styles.statAlert}>
                <div className={styles.statValue}>{stats.newFeedback}</div>
                <div className={styles.statLabel}>Новых обращений</div>
              </Link>
            )}
          </div>
        </>
      )}

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
      </div>

      {/* Два столбца: типы проектов + студенты по направлениям */}
      <div className={styles.twoCol}>
        {/* По типам */}
        <div className={styles.panel}>
          <h2 className={styles.sectionTitle}>По типам проектов</h2>
          <div className={styles.barList}>
            {Object.entries(TYPE_LABELS).map(([key, label]) => {
              const count = stats.typeCounts[key] || 0;
              const pct = stats.totalProjects > 0 ? (count / stats.totalProjects) * 100 : 0;
              return (
                <div key={key} className={styles.barItem}>
                  <div className={styles.barLabel}>
                    <span>{label}</span>
                    <span className={styles.barCount}>{count}</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Студенты по направлениям */}
        <div className={styles.panel}>
          <h2 className={styles.sectionTitle}>Студенты по направлениям</h2>
          {directionCounts.length === 0 ? (
            <p className={styles.noData}>Нет данных</p>
          ) : (
            <div className={styles.barList}>
              {directionCounts.map((d) => {
                const pct = stats.totalStudents > 0 ? (d.count / stats.totalStudents) * 100 : 0;
                return (
                  <div key={d.direction} className={styles.barItem}>
                    <div className={styles.barLabel}>
                      <span>{d.direction || "Не указано"}</span>
                      <span className={styles.barCount}>{d.count}</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Пользователи */}
      <h2 className={styles.sectionTitle}>Пользователи</h2>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalStudents}</div>
          <div className={styles.statLabel}>Студентов</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalSupervisors}</div>
          <div className={styles.statLabel}>Науч. руководителей</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalApplications}</div>
          <div className={styles.statLabel}>Заявок подано</div>
        </div>
      </div>

      {/* Аналитика по НР: типы проектов и магистратуры */}
      <h2 className={styles.sectionTitle}>Распределение научных руководителей</h2>
      <p className={styles.hint} style={{ marginBottom: 16, fontSize: 13, color: "#888" }}>
        Один руководитель может выбрать несколько типов проектов и магистратур, поэтому суммы могут превышать общее число НР.
      </p>
      <div className={styles.twoCol}>
        <div className={styles.panel}>
          <h2 className={styles.sectionTitle}>НР по типам проектов</h2>
          <div className={styles.barList}>
            {supTypeOrdered.map((it) => {
              const pct = (it.count / maxSupType) * 100;
              return (
                <Link key={it.key} href={`/admin/supervisors-list?projectType=${it.key}`} className={styles.barItem} style={{ textDecoration: "none", color: "inherit" }}>
                  <div className={styles.barLabel}>
                    <span>{it.label}</span>
                    <span className={styles.barCount}>{it.count}</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.sectionTitle}>НР по магистратурам</h2>
          {supervisorsByDirection.length === 0 ? (
            <p className={styles.noData}>Нет данных</p>
          ) : (
            <div className={styles.barList}>
              {supervisorsByDirection.map((d) => {
                const pct = (d.count / maxSupDir) * 100;
                return (
                  <Link key={d.direction} href={`/admin/supervisors-list?direction=${encodeURIComponent(d.direction)}`} className={styles.barItem} style={{ textDecoration: "none", color: "inherit" }}>
                    <div className={styles.barLabel}>
                      <span>{d.direction || "Не указано"}</span>
                      <span className={styles.barCount}>{d.count}</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Нагрузка НР */}
      {supervisorWorkload.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Нагрузка научных руководителей</h2>
            <Link href="/admin/workload" style={{ fontSize: 13, fontWeight: 600, color: "#003092" }}>Подробнее →</Link>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>НР</th>
                  <th>Загрузка</th>
                  <th style={{ width: "40%" }}>Прогресс</th>
                  <th>Свободно</th>
                </tr>
              </thead>
              <tbody>
                {supervisorWorkload.slice((workloadPage - 1) * 10, workloadPage * 10).map((sv) => {
                  const free = sv.maxSlots - sv._count.projects;
                  const pct = sv.maxSlots > 0 ? Math.min(100, (sv._count.projects / sv.maxSlots) * 100) : 0;
                  const overloaded = sv._count.projects >= sv.maxSlots;
                  return (
                    <tr key={sv.id}>
                      <td>{sv.user.name || "Без имени"}</td>
                      <td>{sv._count.projects} / {sv.maxSlots}</td>
                      <td>
                        <div style={{ height: 8, background: "#eee", overflow: "hidden", maxWidth: 220 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: overloaded ? "#E8375A" : "#003092", transition: "width 0.3s" }} />
                        </div>
                      </td>
                      <td className={free <= 0 ? styles.noSlots : styles.hasSlots}>
                        {free > 0 ? free : "Нет"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {supervisorWorkload.length > 10 && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => setWorkloadPage((p) => Math.max(1, p - 1))}
                disabled={workloadPage === 1}
                style={{ padding: "4px 10px", border: "1px solid #ddd", background: "#fff", cursor: workloadPage === 1 ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13, opacity: workloadPage === 1 ? 0.5 : 1 }}
              >
                ←
              </button>
              <span style={{ fontSize: 13, color: "#555" }}>
                Стр. {workloadPage} из {Math.ceil(supervisorWorkload.length / 10)} · всего {supervisorWorkload.length}
              </span>
              <button
                onClick={() => setWorkloadPage((p) => Math.min(Math.ceil(supervisorWorkload.length / 10), p + 1))}
                disabled={workloadPage >= Math.ceil(supervisorWorkload.length / 10)}
                style={{ padding: "4px 10px", border: "1px solid #ddd", background: "#fff", cursor: workloadPage >= Math.ceil(supervisorWorkload.length / 10) ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13, opacity: workloadPage >= Math.ceil(supervisorWorkload.length / 10) ? 0.5 : 1 }}
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {/* Два столбца: последние проекты + последние заявки */}
      <div className={styles.twoCol}>
        {/* Последние проекты */}
        <div className={styles.panel}>
          <h2 className={styles.sectionTitle}>Последние проекты</h2>
          {recentProjects.length === 0 ? (
            <p className={styles.noData}>Нет проектов</p>
          ) : (
            <div className={styles.feedList}>
              {recentProjects.map((p) => (
                <div key={p.id} className={styles.feedItem}>
                  <div className={styles.feedTop}>
                    <Link href={`/projects/${p.id}`} className={styles.feedLink}>{p.title}</Link>
                    <span className={`${styles.statusBadge} ${styles[`status_${p.status}`]}`}>
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </div>
                  <div className={styles.feedMeta}>
                    <span>{TYPE_LABELS[p.projectType] || p.projectType}</span>
                    <span>·</span>
                    <span>{p._count.members} участн.</span>
                    {p.supervisor && <><span>·</span><span>НР: {p.supervisor.user.name}</span></>}
                    <span>·</span>
                    <span>{new Date(p.createdAt).toLocaleDateString("ru-RU")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Последние заявки */}
        <div className={styles.panel}>
          <h2 className={styles.sectionTitle}>Последние заявки</h2>
          {recentApplications.length === 0 ? (
            <p className={styles.noData}>Нет заявок</p>
          ) : (
            <div className={styles.feedList}>
              {recentApplications.map((a) => (
                <div key={a.id} className={styles.feedItem}>
                  <div className={styles.feedTop}>
                    <Link href={`/projects/${a.project.id}`} className={styles.feedLink}>
                      {a.project.title}
                    </Link>
                    <span className={`${styles.statusBadge} ${styles[`appStatus_${a.status}`]}`}>
                      {APP_STATUS_LABELS[a.status] || a.status}
                    </span>
                  </div>
                  <div className={styles.feedMeta}>
                    <span>{APP_TYPE_LABELS[a.type] || a.type}</span>
                    {a.student && <><span>·</span><span>{a.student.user.name}</span></>}
                    {a.supervisor && <><span>·</span><span>НР: {a.supervisor.user.name}</span></>}
                    <span>·</span>
                    <span>{new Date(a.createdAt).toLocaleDateString("ru-RU")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ближайшие дедлайны */}
      <div className={styles.alertsSection}>
        <h2 className={styles.sectionTitle}>Ближайшие дедлайны (7 дней)</h2>
        {upcomingDeadlines.length === 0 ? (
          <p className={styles.noData}>Нет ближайших дедлайнов</p>
        ) : (
          <div className={styles.alertList}>
            {upcomingDeadlines.map((d) => (
              <div key={d.id} className={styles.alertItem}>
                <span className={styles.alertDate}>
                  {new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </span>
                <span className={styles.alertTitle}>{d.title}</span>
                {d.project && (
                  <Link href={`/projects/${d.project.id}`} className={styles.alertProject}>
                    {d.project.title}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
