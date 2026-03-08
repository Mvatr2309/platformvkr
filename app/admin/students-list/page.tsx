"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "../list.module.css";

interface Student {
  id: string;
  email: string;
  name: string;
  profileCompleted: boolean;
  student: {
    direction: string;
    course: number;
    cohort: string;
    contact: string;
    competencies: string[];
  } | null;
}

const DIRECTIONS = [
  "Управление IT продуктом",
  "Разработка IT-продуктов",
  "Науки о данных",
];

const COHORTS = ["Поток2025", "Поток2026"];

export default function StudentsListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

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

    list = [...list].sort((a, b) => {
      const cmp = (a.name || "").localeCompare(b.name || "", "ru");
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [students, search, directionFilter, cohortFilter, sortAsc]);

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
          <option value="">Все направления</option>
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
              <th>Направление</th>
              <th>Курс</th>
              <th>Когорта</th>
              <th>Контакт</th>
              <th>Профиль</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className={styles.empty}>Студентов не найдено</td></tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.name || <span className={styles.muted}>Не указано</span>}</td>
                <td>{s.email}</td>
                <td>{s.student?.direction || <span className={styles.muted}>—</span>}</td>
                <td>{s.student?.course || <span className={styles.muted}>—</span>}</td>
                <td>{s.student?.cohort || <span className={styles.muted}>—</span>}</td>
                <td>{s.student?.contact || <span className={styles.muted}>—</span>}</td>
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
    </div>
  );
}
