"use client";

import { useEffect, useState } from "react";
import styles from "../expert-form.module.css";

// FR-08: админ отмечает, каким потокам открыта экспертная труба (08.07).
// Потоки берутся из существующего справочника cohorts.

type Row = { cohort: string; isOpen: boolean; students: number };

export default function CohortAccessPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [orphans, setOrphans] = useState<Row[]>([]);
  const [withoutCohort, setWithoutCohort] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/expert/admin/access");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.cohorts || []);
      setOrphans(data.orphanCohorts || []);
      setWithoutCohort(data.studentsWithoutCohort || 0);
    } catch {
      setError("Не удалось загрузить потоки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(cohort: string, isOpen: boolean) {
    setBusy(cohort);
    setError("");
    try {
      const res = await fetch("/api/expert/admin/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort, isOpen }),
      });
      if (!res.ok) throw new Error();
      setRows((prev) => prev.map((r) => (r.cohort === cohort ? { ...r, isOpen } : r)));
      setOrphans((prev) => prev.map((r) => (r.cohort === cohort ? { ...r, isOpen } : r)));
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className={styles.loading}>Загружаем потоки…</div>;

  const openCount = [...rows, ...orphans].filter((r) => r.isOpen).length;
  const studentsWithAccess = [...rows, ...orphans]
    .filter((r) => r.isOpen)
    .reduce((sum, r) => sum + r.students, 0);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Доступ по потокам</h1>

      <p className={styles.fieldHint} style={{ marginBottom: 24, fontSize: 14 }}>
        Отметьте потоки, которым открыта экспертная труба. Изменение действует сразу,
        отдельной даты открытия нет. Студенты закрытых потоков видят раздел с замком.
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Открыто потоков: {openCount} — это {studentsWithAccess} студентов
        </h2>

        {rows.length === 0 && (
          <p className={styles.fieldHint}>
            В справочнике «Потоки» нет значений. Добавьте их в разделе «Справочники» админки платформы.
          </p>
        )}

        {rows.map((r) => (
          <label key={r.cohort} className={styles.checkboxLabel} style={{ display: "flex", padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
            <input
              type="checkbox"
              checked={r.isOpen}
              disabled={busy === r.cohort}
              onChange={(e) => toggle(r.cohort, e.target.checked)}
            />
            <span style={{ flex: 1 }}>{r.cohort}</span>
            <span className={styles.fieldHint} style={{ margin: 0 }}>{r.students} студентов</span>
          </label>
        ))}
      </section>

      {orphans.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Потоки вне справочника</h2>
          <p className={styles.fieldHint} style={{ marginBottom: 12 }}>
            У этих студентов стоит поток, которого нет в справочнике «Потоки» — скорее всего,
            значение переименовали после присвоения. Доступ им можно открыть и так, но лучше
            привести значения в порядок.
          </p>
          {orphans.map((r) => (
            <label key={r.cohort} className={styles.checkboxLabel} style={{ display: "flex", padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>
              <input
                type="checkbox"
                checked={r.isOpen}
                disabled={busy === r.cohort}
                onChange={(e) => toggle(r.cohort, e.target.checked)}
              />
              <span style={{ flex: 1 }}>{r.cohort}</span>
              <span className={styles.fieldHint} style={{ margin: 0 }}>{r.students} студентов</span>
            </label>
          ))}
        </section>
      )}

      {withoutCohort > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Студентов без потока: {withoutCohort}</h2>
          <p className={styles.fieldHint}>
            Пустой поток означает, что доступа к трубе у студента нет и открыть его нечем.
            Проставьте таким студентам поток в списке студентов админки платформы.
          </p>
        </section>
      )}
    </div>
  );
}
