"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "../list.module.css";

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
    maxSlots: number;
  } | null;
}

export default function SupervisorsListPage() {
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
  }, [supervisors, search, sortAsc]);

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <h1 className={styles.title}>Список научных руководителей</h1>

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
            {filtered.length === 0 && (
              <tr><td colSpan={8} className={styles.empty}>Научные руководители не найдены</td></tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.name || <span className={styles.muted}>Не указано</span>}</td>
                <td>{s.email}</td>
                <td>{s.supervisor?.workplace || <span className={styles.muted}>—</span>}</td>
                <td>{s.supervisor?.position || <span className={styles.muted}>—</span>}</td>
                <td>{s.supervisor?.academicDegree || <span className={styles.muted}>—</span>}</td>
                <td>{s.supervisor?.contact || <span className={styles.muted}>—</span>}</td>
                <td>{s.supervisor?.maxSlots || <span className={styles.muted}>—</span>}</td>
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
