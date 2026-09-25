"use client";

import { useEffect, useState } from "react";
import styles from "../requests/requests.module.css";

// FR-08: метрики конверсии запрос → встреча (08.19).

type Metrics = {
  total: number;
  statusCounts: Record<string, number>;
  contactsExchanged: number;
  meetings: { met: number; notMet: number; noData: number };
  conversion: number | null;
  avgRating: number | null;
  ratingsCount: number;
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "На проверке у модератора",
  NEEDS_REVISION: "На доработке у студента",
  APPROVED_BY_MODERATOR: "Ждут решения эксперта",
  REJECTED_BY_MODERATOR: "Отклонены модератором",
  REJECTED_BY_EXPERT: "Отклонены экспертом",
  CONTACTS_SENT: "Контакты отправлены",
  AWAITING_FEEDBACK: "Ждут обратной связи",
  CLOSED: "Закрыты",
};

export default function MetricsPanel() {
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/expert/admin/metrics")
      .then((r) => (r.ok ? r.json() : null))
      .then(setM)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.wrapper}><p className={styles.empty}>Загружаем…</p></div>;
  if (!m) return <div className={styles.wrapper}><p className={styles.empty}>Не удалось загрузить метрики</p></div>;

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Метрики раздела</h1>
      <p className={styles.subtitle}>
        Конверсия считается от числа обменов контактами, а не от всех запросов: те, что
        отклонили модератор или эксперт, до встречи дойти не могли.
      </p>

      <div className={styles.card}>
        <div className={styles.blockTitle}>Конверсия запрос → встреча</div>
        <p className={styles.metricBig}>
          {m.conversion === null ? "нет данных" : `${m.conversion}%`}
        </p>
        <p className={styles.blockText}>
          Контактами обменялись {m.contactsExchanged} раз из {m.total} запросов.
        </p>

        <div className={styles.block}>
          <div className={styles.blockTitle}>Из них</div>
          <p className={styles.blockText}>Встреча состоялась: <strong>{m.meetings.met}</strong></p>
          <p className={styles.blockText}>Встреча не состоялась: <strong>{m.meetings.notMet}</strong></p>
          <p className={styles.blockText}>
            Нет данных: <strong>{m.meetings.noData}</strong>
            <span className={styles.cardMeta}> — никто не ответил, запрос закрылся сам</span>
          </p>
        </div>

        {m.avgRating !== null && (
          <div className={styles.block}>
            <div className={styles.blockTitle}>Средняя оценка студентов</div>
            <p className={styles.blockText}>
              <strong>{m.avgRating}</strong> из 5 — по {m.ratingsCount} ответам
            </p>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.blockTitle}>Запросы по статусам</div>
        {Object.keys(m.statusCounts).length === 0 ? (
          <p className={styles.blockText}>Запросов пока нет.</p>
        ) : (
          Object.entries(m.statusCounts).map(([status, count]) => (
            <p key={status} className={styles.blockText}>
              {STATUS_LABELS[status] || status}: <strong>{count}</strong>
            </p>
          ))
        )}
      </div>
    </div>
  );
}
