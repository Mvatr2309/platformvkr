"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDictionaries } from "@/lib/useDictionary";
import { useTableSort, compareValues, type SortValue } from "@/lib/useTableSort";
import Pagination, { usePagination } from "@/components/Pagination";
import styles from "../list.module.css";

interface Student {
  id: string;
  email: string;
  name: string;
  profileCompleted: boolean;
  inSystem: boolean;
  memberId?: string;
  student: {
    direction: string;
    course: number | null;
    cohort: string | null;
    contact: string | null;
    competencies: string[];
  } | null;
  projectInfo?: string;
}

export default function StudentsListPage() {
  const dicts = useDictionaries("directions", "cohorts");
  const DIRECTIONS = dicts.directions || [];
  const COHORTS = dicts.cohorts || [];
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "in_system" | "profile_incomplete" | "not_in_system">("");
  const { sortField, sortAsc, toggleSort, arrow } = useTableSort<
    "name" | "email" | "direction" | "course" | "cohort" | "contact" | "status"
  >("name");

  const fetchStudents = useCallback(async () => {
    const res = await fetch("/api/admin/students-list");
    if (res.ok) setStudents(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const filtered = useMemo(() => {
    let list = students;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
      );
    }

    if (directionFilter) {
      list = list.filter((s) => s.student?.direction === directionFilter);
    }

    if (cohortFilter) {
      list = list.filter((s) => s.student?.cohort === cohortFilter);
    }

    if (statusFilter === "in_system") {
      list = list.filter((s) => s.inSystem && s.profileCompleted);
    } else if (statusFilter === "profile_incomplete") {
      list = list.filter((s) => s.inSystem && !s.profileCompleted);
    } else if (statusFilter === "not_in_system") {
      list = list.filter((s) => !s.inSystem);
    }

    const sortVal = (s: Student): SortValue => {
      switch (sortField) {
        case "email": return s.email;
        case "direction": return s.student?.direction;
        case "course": return s.student?.course;
        case "cohort": return s.student?.cohort;
        case "contact": return s.student?.contact;
        case "status": return !s.inSystem ? 2 : s.profileCompleted ? 0 : 1;
        default: return s.name;
      }
    };

    list = [...list].sort((a, b) => {
      const cmp = compareValues(sortVal(a), sortVal(b), sortAsc);
      if (cmp !== 0) return cmp;
      return (a.name || "").localeCompare(b.name || "", "ru");
    });

    return list;
  }, [students, search, directionFilter, cohortFilter, statusFilter, sortField, sortAsc]);

  const { page, setPage, totalPages, paged } = usePagination(filtered, 20);

  useEffect(() => { setPage(1); }, [search, directionFilter, cohortFilter, statusFilter, setPage]);

  const inSystemCount = students.filter((s) => s.inSystem && s.profileCompleted).length;
  const profileIncompleteCount = students.filter((s) => s.inSystem && !s.profileCompleted).length;
  const notInSystemCount = students.filter((s) => !s.inSystem).length;

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <h1 className={styles.title}>Список студентов</h1>

      <div className={styles.controls}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по ФИО или email..."
          className={styles.searchInput}
        />
        <select
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">Все магистратуры</option>
          {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={cohortFilter}
          onChange={(e) => setCohortFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">Все когорты</option>
          {COHORTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | "in_system" | "profile_incomplete" | "not_in_system")}
          className={styles.filterSelect}
        >
          <option value="">Все статусы ({students.length})</option>
          <option value="in_system">В системе ({inSystemCount})</option>
          <option value="profile_incomplete">Профиль не заполнен ({profileIncompleteCount})</option>
          <option value="not_in_system">Не в системе ({notInSystemCount})</option>
        </select>
        <span className={styles.count}>Найдено: {filtered.length}</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => toggleSort("name")}>ФИО{arrow("name")}</th>
              <th onClick={() => toggleSort("email")}>Email{arrow("email")}</th>
              <th onClick={() => toggleSort("direction")}>Магистратура{arrow("direction")}</th>
              <th onClick={() => toggleSort("course")}>Курс{arrow("course")}</th>
              <th onClick={() => toggleSort("cohort")}>Когорта{arrow("cohort")}</th>
              <th onClick={() => toggleSort("contact")}>Контакт{arrow("contact")}</th>
              <th onClick={() => toggleSort("status")}>Статус ЛК{arrow("status")}</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr><td colSpan={7} className={styles.empty}>Студентов не найдено</td></tr>
            )}
            {paged.map((s) => (
              <tr key={s.id}>
                <td>{s.name || <span className={styles.muted}>Не указано</span>}</td>
                <td>
                  {s.inSystem ? (
                    <a href={`/admin/students/${s.id}`} className={styles.link}>{s.email}</a>
                  ) : (
                    s.email
                  )}
                </td>
                <td>{s.student?.direction || <span className={styles.muted}>—</span>}</td>
                <td>{s.student?.course || <span className={styles.muted}>—</span>}</td>
                <td>{s.student?.cohort || <span className={styles.muted}>—</span>}</td>
                <td>{s.student?.contact || <span className={styles.muted}>—</span>}</td>
                <td>
                  {s.inSystem ? (
                    s.profileCompleted ? (
                      <span className={styles.statusBadge + " " + styles.status_OPEN}>В системе</span>
                    ) : (
                      <span className={styles.statusBadge + " " + styles.status_PENDING}>Профиль не заполнен</span>
                    )
                  ) : (
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: "#fce4ec",
                      color: "#c62828",
                    }}>Не в системе</span>
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
