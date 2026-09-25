"use client";

import { useEffect, useState } from "react";
import styles from "../expert-form.module.css";

// FR-08: админ отмечает, каким потокам открыто пространство (08.07, A1).
// У каждого пространства своя страница «Доступ по потокам»: экспертная труба —
// в админке трубы (/expert/admin/access), «Платформа ВКР» — в админке платформы
// (/admin/cohort-access). Флаги независимы, API общий — он меняет только переданный флаг.
// Потоки берутся из существующего справочника cohorts.

type Space = "expert" | "vkr";
type Row = { cohort: string; isOpen: boolean; platformOpen: boolean; students: number };
type Flag = "isOpen" | "platformOpen";

const TEXT: Record<Space, { flag: Flag; label: string; hint: string; openSummary: string; noCohort: string }> = {
  expert: {
    flag: "isOpen",
    label: "Экспертная труба",
    hint:
      "Отметьте потоки, которым открыта экспертная труба: каталог экспертов и запросы на консультацию. " +
      "Изменение действует сразу, отдельной даты открытия нет. Новый поток закрыт, пока вы не откроете его здесь. " +
      "Студенты закрытого потока видят раздел с замком. Доступ к платформе ВКР настраивается отдельно — " +
      "в админке платформы, «Пользователи → Доступ по потокам».",
    openSummary: "Экспертная труба открыта потокам",
    noCohort: "Пустой поток означает, что экспертная труба студенту закрыта, а открыть её нечем.",
  },
  vkr: {
    flag: "platformOpen",
    label: "Платформа ВКР",
    hint:
      "Отметьте потоки, которым открыта платформа ВКР: проекты, научные руководители, заявки, календарь, " +
      "база знаний и НИР. Студенты закрытого потока вместо разделов платформы видят заглушку «Раздел ещё не открыт», " +
      "профиль и обращения им доступны. Изменение действует сразу. Новый поток закрыт, пока вы не откроете его здесь. " +
      "Экспертная труба настраивается отдельно — в её админке.",
    openSummary: "Платформа ВКР открыта потокам",
    noCohort: "Пустой поток означает, что платформа ВКР студенту закрыта, а открыть её нечем.",
  },
};

export default function CohortAccessPanel({ space }: { space: Space }) {
  const t = TEXT[space];
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

  async function toggle(cohort: string, value: boolean) {
    setBusy(cohort);
    setError("");
    try {
      const res = await fetch("/api/expert/admin/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort, [t.flag]: value }),
      });
      if (!res.ok) throw new Error();
      const apply = (prev: Row[]) =>
        prev.map((r) => (r.cohort === cohort ? { ...r, [t.flag]: value } : r));
      setRows(apply);
      setOrphans(apply);
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className={styles.loading}>Загружаем потоки…</div>;

  const open = [...rows, ...orphans].filter((r) => r[t.flag]);
  const openStudents = open.reduce((sum, r) => sum + r.students, 0);

  const renderRow = (r: Row) => (
    <div key={r.cohort} className={styles.accessRow}>
      <span>{r.cohort}</span>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={r[t.flag]}
          disabled={busy === r.cohort}
          onChange={(e) => toggle(r.cohort, e.target.checked)}
          aria-label={`${t.label} — ${r.cohort}`}
        />
      </label>
      <span className={styles.fieldHint} style={{ margin: 0 }}>{r.students} студентов</span>
    </div>
  );

  const head = (
    <div className={`${styles.accessRow} ${styles.accessHead}`}>
      <span>Поток</span>
      <span>{t.label}</span>
      <span />
    </div>
  );

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Доступ по потокам — {t.label}</h1>

      <p className={styles.fieldHint} style={{ marginBottom: 24, fontSize: 14 }}>
        {t.hint}
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {t.openSummary}: {open.length} ({openStudents} студентов)
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
            {t.noCohort} Проставьте таким студентам поток в списке студентов админки платформы.
          </p>
        </section>
      )}
    </div>
  );
}
