"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Pagination, { usePagination } from "@/components/Pagination";
import styles from "../list.module.css";

interface WorkloadItem {
  id: string;
  maxSlots: number;
  maxProjects: number;
  workplace: string;
  position: string;
  contact: string;
  directions: string[];
  projectTypes: string[];
  recruitmentStatus: string;
  effectiveStatus: "OPEN" | "CLOSED";
  closureReason: "manual" | "full" | null;
  user: { id: string; name: string; email: string };
  _count: { projects: number };
}

export default function WorkloadPage() {
  const [items, setItems] = useState<WorkloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"load_desc" | "load_asc" | "name_asc" | "name_desc">("load_desc");
  const [statusFilter, setStatusFilter] = useState<"" | "free" | "full" | "overloaded" | "closed">("");

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/workload");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        (s.user.name || "").toLowerCase().includes(q) ||
        (s.user.email || "").toLowerCase().includes(q) ||
        (s.workplace || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter === "free") {
      list = list.filter((s) => s._count.projects < s.maxSlots && s.recruitmentStatus === "OPEN");
    } else if (statusFilter === "full") {
      list = list.filter((s) => s._count.projects === s.maxSlots);
    } else if (statusFilter === "overloaded") {
      list = list.filter((s) => s._count.projects > s.maxSlots);
    } else if (statusFilter === "closed") {
      list = list.filter((s) => s.recruitmentStatus === "CLOSED");
    }
    list = [...list].sort((a, b) => {
      if (sort === "load_desc") return b._count.projects - a._count.projects;
      if (sort === "load_asc") return a._count.projects - b._count.projects;
      const cmp = (a.user.name || "").localeCompare(b.user.name || "", "ru");
      return sort === "name_asc" ? cmp : -cmp;
    });
    return list;
  }, [items, search, sort, statusFilter]);

  const { page, setPage, totalPages, paged } = usePagination(filtered, 20);

  useEffect(() => { setPage(1); }, [search, sort, statusFilter, setPage]);

  if (loading) return <p>Загрузка...</p>;

  const totalFree = items.reduce((acc, s) => acc + Math.max(0, s.maxSlots - s._count.projects), 0);
  const totalAssigned = items.reduce((acc, s) => acc + s._count.projects, 0);

  return (
    <div>
      <h1 className={styles.title}>Нагрузка научных руководителей</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ padding: "8px 16px", background: "rgba(0,48,146,0.06)", border: "1px solid var(--color-border)", fontSize: 13 }}>
          Всего НР: <strong>{items.length}</strong>
        </div>
        <div style={{ padding: "8px 16px", background: "rgba(0,48,146,0.06)", border: "1px solid var(--color-border)", fontSize: 13 }}>
          Занято слотов: <strong>{totalAssigned}</strong>
        </div>
        <div style={{ padding: "8px 16px", background: "rgba(46,125,50,0.08)", border: "1px solid var(--color-border)", fontSize: 13 }}>
          Свободно слотов: <strong>{totalFree}</strong>
        </div>
      </div>

      <div className={styles.controls}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по ФИО, email или месту работы..."
          className={styles.searchInput}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          style={{ padding: "8px 12px", border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit" }}
        >
          <option value="load_desc">По убыванию загрузки</option>
          <option value="load_asc">По возрастанию загрузки</option>
          <option value="name_asc">По имени (А→Я)</option>
          <option value="name_desc">По имени (Я→А)</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          style={{ padding: "8px 12px", border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit" }}
        >
          <option value="">Все НР</option>
          <option value="free">Со свободными слотами</option>
          <option value="full">Полная загрузка</option>
          <option value="overloaded">Перегружены</option>
          <option value="closed">Закрыли набор вручную</option>
        </select>
        <span className={styles.count}>Найдено: {filtered.length}</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Место работы</th>
              <th>Контакт</th>
              <th style={{ width: 90 }}>Загрузка</th>
              <th style={{ width: 220 }}>Прогресс</th>
              <th style={{ width: 110 }}>Статус набора</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr><td colSpan={6} className={styles.empty}>НР не найдены</td></tr>
            )}
            {paged.map((s) => {
              const pct = s.maxSlots > 0 ? Math.min(100, (s._count.projects / s.maxSlots) * 100) : 0;
              const overloaded = s._count.projects > s.maxSlots;
              const full = s._count.projects === s.maxSlots;
              return (
                <tr key={s.id}>
                  <td>
                    <Link href={`/supervisors/${s.id}`} style={{ color: "#003092", fontWeight: 500 }}>
                      {s.user.name || s.user.email}
                    </Link>
                    <div style={{ fontSize: 12, color: "#888" }}>{s.user.email}</div>
                  </td>
                  <td>{s.workplace || <span className={styles.muted}>—</span>}</td>
                  <td>{s.contact || <span className={styles.muted}>—</span>}</td>
                  <td>
                    <strong style={{ color: overloaded ? "#E8375A" : full ? "#003092" : "#2e7d32" }}>
                      {s._count.projects} / {s.maxSlots}
                    </strong>
                  </td>
                  <td>
                    <div style={{ height: 8, background: "#eee", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: overloaded ? "#E8375A" : full ? "#003092" : "#2e7d32", transition: "width 0.3s" }} />
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: "2px 8px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: s.effectiveStatus === "OPEN" ? "rgba(46,125,50,0.1)" : s.closureReason === "manual" ? "#f0f0f0" : "rgba(232,55,90,0.08)",
                      color: s.effectiveStatus === "OPEN" ? "#2e7d32" : s.closureReason === "manual" ? "#888" : "#E8375A",
                    }}
                    title={s.closureReason === "manual" ? "Закрыто вручную" : s.closureReason === "full" ? "Все слоты заняты" : ""}
                    >
                      {s.effectiveStatus === "OPEN"
                        ? "Принимает"
                        : s.closureReason === "manual"
                          ? "Закрыто вручную"
                          : "Слоты заняты"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
