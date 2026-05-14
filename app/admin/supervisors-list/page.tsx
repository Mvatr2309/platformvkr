"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Pagination, { usePagination } from "@/components/Pagination";
import styles from "../list.module.css";

const TYPE_LABELS: Record<string, string> = {
  CLASSIC_DISSERTATION: "Исследование",
  STARTUP: "Стартап",
  CORPORATE_STARTUP: "Корп. стартап",
};

interface Supervisor {
  id: string;
  email: string;
  name: string;
  profileCompleted: boolean;
  supervisor: {
    workplace: string;
    position: string;
    academicDegree: string;
    contact: string;
    expertise: string[];
    maxProjects: number;
    projectTypes: string[];
    directions: string[];
    status: string;
  } | null;
}

export default function SupervisorsListPage() {
  return (
    <Suspense fallback={<p>Загрузка...</p>}>
      <SupervisorsListInner />
    </Suspense>
  );
}

function SupervisorsListInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectTypeFilter = searchParams.get("projectType");
  const directionFilter = searchParams.get("direction");

  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/supervisors-list");
    if (res.ok) setSupervisors(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = supervisors;

    if (projectTypeFilter) {
      list = list.filter((s) => s.supervisor?.projectTypes?.includes(projectTypeFilter));
    }
    if (directionFilter) {
      list = list.filter((s) => s.supervisor?.directions?.includes(directionFilter));
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      const cmp = (a.name || "").localeCompare(b.name || "", "ru");
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [supervisors, search, sortAsc, projectTypeFilter, directionFilter]);

  const { page, setPage, totalPages, paged } = usePagination(filtered, 20);

  useEffect(() => { setPage(1); }, [search, projectTypeFilter, directionFilter, setPage]);

  if (loading) return <p>Загрузка...</p>;

  const hasUrlFilter = !!(projectTypeFilter || directionFilter);

  return (
    <div>
      <h1 className={styles.title}>Список научных руководителей</h1>

      {hasUrlFilter && (
        <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#555" }}>Фильтр:</span>
          {projectTypeFilter && (
            <span style={{ background: "rgba(0,48,146,0.08)", color: "#003092", padding: "4px 10px", fontSize: 13, fontWeight: 600 }}>
              Тип проектов: {TYPE_LABELS[projectTypeFilter] || projectTypeFilter}
            </span>
          )}
          {directionFilter && (
            <span style={{ background: "rgba(0,48,146,0.08)", color: "#003092", padding: "4px 10px", fontSize: 13, fontWeight: 600 }}>
              Магистратура: {directionFilter}
            </span>
          )}
          <button
            type="button"
            onClick={() => router.push("/admin/supervisors-list")}
            style={{ background: "none", border: "1px solid #ddd", padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
          >
            Сбросить фильтр
          </button>
        </div>
      )}

      <div className={styles.controls}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по ФИО или email..."
          className={styles.searchInput}
        />
        <span className={styles.count}>Найдено: {filtered.length}</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => setSortAsc(!sortAsc)}>
                ФИО {sortAsc ? "↑" : "↓"}
              </th>
              <th>Email</th>
              <th>Место работы</th>
              <th>Должность</th>
              <th>Степень</th>
              <th>Контакт</th>
              <th>Слоты</th>
              <th>Профиль</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr><td colSpan={8} className={styles.empty}>Научные руководители не найдены</td></tr>
            )}
            {paged.map((s) => (
              <tr key={s.id}>
                <td>{s.name || <span className={styles.muted}>Не указано</span>}</td>
                <td>{s.email}</td>
                <td>{s.supervisor?.workplace || <span className={styles.muted}>—</span>}</td>
                <td>{s.supervisor?.position || <span className={styles.muted}>—</span>}</td>
                <td>{s.supervisor?.academicDegree || <span className={styles.muted}>—</span>}</td>
                <td>{s.supervisor?.contact || <span className={styles.muted}>—</span>}</td>
                <td>{s.supervisor?.maxProjects || <span className={styles.muted}>—</span>}</td>
                <td>
                  {s.profileCompleted ? (
                    <span className={styles.statusBadge + " " + styles.status_OPEN}>Заполнен</span>
                  ) : (
                    <span className={styles.statusBadge + " " + styles.status_PENDING}>Не заполнен</span>
                  )}
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
