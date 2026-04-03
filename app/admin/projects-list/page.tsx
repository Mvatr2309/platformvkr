"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Pagination, { usePagination } from "@/components/Pagination";
import styles from "../list.module.css";

interface Project {
  id: string;
  title: string;
  projectType: string;
  status: string;
  direction: string | null;
  createdAt: string;
  supervisor: { user: { name: string } } | null;
  _count: { members: number; applications: number };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  OPEN: "Открыт",
  ACTIVE: "Активный",
  COMPLETED: "Завершён",
};

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/projects-list");
    if (res.ok) setProjects(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = projects;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        (p.supervisor?.user?.name || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      list = list.filter((p) => p.status === statusFilter);
    }

    list = [...list].sort((a, b) => {
      const cmp = a.title.localeCompare(b.title, "ru");
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [projects, search, statusFilter, sortAsc]);

  const { page, setPage, totalPages, paged } = usePagination(filtered, 20);

  useEffect(() => { setPage(1); }, [search, statusFilter, setPage]);

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <h1 className={styles.title}>Список проектов</h1>

      <div className={styles.controls}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию или руководителю..."
          className={styles.searchInput}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className={styles.count}>Найдено: {filtered.length}</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => setSortAsc(!sortAsc)}>
                Название {sortAsc ? "↑" : "↓"}
              </th>
              <th>Статус</th>
              <th>Магистратура</th>
              <th>Руководитель</th>
              <th>Команда</th>
              <th>Заявки</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr><td colSpan={7} className={styles.empty}>Проектов не найдено</td></tr>
            )}
            {paged.map((p) => (
              <tr key={p.id}>
                <td>
                  <a href={`/projects/${p.id}`} className={styles.link}>{p.title}</a>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${styles[`status_${p.status}`]}`}>
                    {STATUS_LABELS[p.status] || p.status}
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
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
