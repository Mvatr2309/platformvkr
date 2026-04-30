"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./inquiries.module.css";

interface Inquiry {
  id: string;
  category: "BUG" | "SUGGESTION" | "QUESTION";
  message: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED";
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  BUG: "Баг",
  SUGGESTION: "Предложение",
  QUESTION: "Вопрос",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Новое",
  IN_PROGRESS: "В работе",
  RESOLVED: "Решено",
};

export default function InquiriesPage() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback?mine=true");
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Мои обращения</h1>
        <p className={styles.hint}>
          Здесь сохраняются обращения, которые вы отправили через кнопку «Обратная связь», и ответы команды разработки.
        </p>

        {loading ? (
          <p className={styles.empty}>Загрузка...</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>
            Вы ещё не отправляли обращений. Кнопка «Обратная связь» в боковом меню или в правом нижнем углу.
          </p>
        ) : (
          <div className={styles.list}>
            {items.map((it) => (
              <div key={it.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.headerLeft}>
                    <span className={`${styles.badge} ${styles[`category_${it.category}`]}`}>
                      {CATEGORY_LABELS[it.category]}
                    </span>
                    <span className={`${styles.status} ${styles[`status_${it.status}`]}`}>
                      {STATUS_LABELS[it.status]}
                    </span>
                  </div>
                  <span className={styles.date}>
                    {new Date(it.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>

                <div className={styles.message}>{it.message}</div>

                {it.response ? (
                  <div className={styles.response}>
                    <div className={styles.responseHeader}>
                      Ответ команды разработки
                      {it.respondedAt && (
                        <span className={styles.responseDate}>
                          · {new Date(it.respondedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <div className={styles.responseText}>{it.response}</div>
                  </div>
                ) : (
                  <div className={styles.pending}>
                    {it.status === "RESOLVED"
                      ? "Обращение закрыто без письменного ответа."
                      : "Ответ ещё не получен. Команда разработки рассмотрит обращение в ближайшее время."}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
