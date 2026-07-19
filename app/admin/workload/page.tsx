"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useTableSort, compareValues, type SortValue } from "@/lib/useTableSort";
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
  const { sortField, sortAsc, setSortField, setSortAsc, toggleSort, arrow } = useTableSort<
    "name" | "workplace" | "contact" | "load" | "status"
  >("load", false);
  const [statusFilter, setStatusFilter] = useState<"" | "free" | "full" | "overloaded" | "closed">("");

  // Значение селекта сортировки, синхронизированное с кликами по заголовкам
  const sortSelectValue =
    sortField === "load" ? (sortAsc ? "load_asc" : "load_desc")
    : sortField === "name" ? (sortAsc ? "name_asc" : "name_desc")
    : "";

  function handleSortSelect(value: string) {
    if (value === "load_desc") { setSortField("load"); setSortAsc(false); }
    else if (value === "load_asc") { setSortField("load"); setSortAsc(true); }
    else if (value === "name_asc") { setSortField("name"); setSortAsc(true); }
    else if (value === "name_desc") { setSortField("name"); setSortAsc(false); }
  }

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
    const sortVal = (s: WorkloadItem): SortValue => {
      switch (sortField) {
        case "workplace": return s.workplace;
        case "contact": return s.contact;
        // Загрузка/Прогресс — по доле занятых слотов
        case "load": return s.maxSlots > 0 ? s._count.projects / s.maxSlots : s._count.projects > 0 ? 999 : 0;
        // Принимает → Слоты заняты → Закрыто вручную
        case "status": return s.effectiveStatus === "OPEN" ? 0 : s.closureReason === "full" ? 1 : 2;
        default: return s.user.name;
      }
    };

    list = [...list].sort((a, b) => {
      const cmp = compareValues(sortVal(a), sortVal(b), sortAsc);
      if (cmp !== 0) return cmp;
      return (a.user.name || "").localeCompare(b.user.name || "", "ru");
    });
    return list;
  }, [items, search, sortField, sortAsc, statusFilter]);

  const { page, setPage, totalPages, paged } = usePagination(filtered, 20);

  useEffect(() => { setPage(1); }, [search, sortField, sortAsc, statusFilter, setPage]);

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
          value={sortSelectValue}
          onChange={(e) => handleSortSelect(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit" }}
        >
          {sortSelectValue === "" && <option value="" disabled>По колонке таблицы</option>}
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
              <th onClick={() => toggleSort("name")}>ФИО{arrow("name")}</th>
              <th onClick={() => toggleSort("workplace")}>Место работы{arrow("workplace")}</th>
              <th onClick={() => toggleSort("contact")}>Контакт{arrow("contact")}</th>
              <th style={{ width: 90 }} onClick={() => toggleSort("load")}>Загрузка{arrow("load")}</th>
              <th style={{ width: 220 }} onClick={() => toggleSort("load")}>Прогресс{arrow("load")}</th>
              <th style={{ width: 110 }} onClick={() => toggleSort("status")}>Статус набора{arrow("status")}</th>
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
