"use client";

import { useEffect, useState } from "react";
import styles from "../expert-form.module.css";

// FR-08: админ отмечает, что открыто каждому потоку (08.07, A1).
// Экспертная труба и «Платформа ВКР» открываются независимо друг от друга.
// Потоки берутся из существующего справочника cohorts.

type Row = { cohort: string; isOpen: boolean; platformOpen: boolean; students: number };
type Flag = "isOpen" | "platformOpen";

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

  async function toggle(cohort: string, flag: Flag, value: boolean) {
    setBusy(`${cohort}:${flag}`);
    setError("");
    try {
      const res = await fetch("/api/expert/admin/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort, [flag]: value }),
      });
      if (!res.ok) throw new Error();
      const apply = (prev: Row[]) =>
        prev.map((r) => (r.cohort === cohort ? { ...r, [flag]: value } : r));
      setRows(apply);
      setOrphans(apply);
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className={styles.loading}>Загружаем потоки…</div>;

  const all = [...rows, ...orphans];
  const summary = (flag: Flag) => {
    const open = all.filter((r) => r[flag]);
    return `${open.length} (${open.reduce((sum, r) => sum + r.students, 0)} студентов)`;
  };

  const renderRow = (r: Row) => (
    <div key={r.cohort} className={styles.accessRow}>
      <span>{r.cohort}</span>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={r.isOpen}
          disabled={busy === `${r.cohort}:isOpen`}
          onChange={(e) => toggle(r.cohort, "isOpen", e.target.checked)}
          aria-label={`Экспертная труба — ${r.cohort}`}
        />
      </label>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={r.platformOpen}
          disabled={busy === `${r.cohort}:platformOpen`}
          onChange={(e) => toggle(r.cohort, "platformOpen", e.target.checked)}
          aria-label={`Платформа ВКР — ${r.cohort}`}
        />
      </label>
      <span className={styles.fieldHint} style={{ margin: 0 }}>{r.students} студентов</span>
    </div>
  );

  const head = (
    <div className={`${styles.accessRow} ${styles.accessHead}`}>
      <span>Поток</span>
      <span>Экспертная труба</span>
      <span>Платформа ВКР</span>
      <span />
    </div>
  );

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Доступ по потокам</h1>

      <p className={styles.fieldHint} style={{ marginBottom: 24, fontSize: 14 }}>
        Отметьте, что открыто каждому потоку. Экспертная труба и платформа ВКР открываются
        независимо: поток может видеть трубу и не видеть платформу. Изменение действует сразу,
        отдельной даты открытия нет. Новый поток закрыт, пока вы не откроете его здесь.
        Студенты закрытого потока видят раздел с замком.
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Труба открыта потокам: {summary("isOpen")}. Платформа ВКР: {summary("platformOpen")}
        </h2>

        {rows.length === 0 ? (
          <p className={styles.fieldHint}>
            В справочнике «Потоки» нет значений. Добавьте их в разделе «Справочники» админки платформы.
          </p>
        ) : (
          <>
            {head}
            {rows.map(renderRow)}
          </>
        )}
      </section>

      {orphans.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Потоки вне справочника</h2>
          <p className={styles.fieldHint} style={{ marginBottom: 12 }}>
            У этих студентов стоит поток, которого нет в справочнике «Потоки» — скорее всего,
            значение переименовали после присвоения. Доступ им можно открыть и так, но лучше
            привести значения в порядок.
          </p>
          {head}
          {orphans.map(renderRow)}
        </section>
      )}

      {withoutCohort > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Студентов без потока: {withoutCohort}</h2>
          <p className={styles.fieldHint}>
            Пустой поток означает, что студенту закрыты и труба, и платформа ВКР, а открыть
            их нечем. Проставьте таким студентам поток в списке студентов админки платформы.
          </p>
        </section>
      )}
    </div>
  );
}
