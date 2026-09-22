"use client";

import { useState } from "react";
import styles from "./requests.module.css";

// FR-08: встроенная форма обратной связи (08.16).
// Студента спрашиваем про встречу, оценку и комментарий, эксперта — про встречу
// и комментарий. Два ответа на один вопрос «встреча была?» дают честную метрику:
// одного ответа студента мало, при сорвавшейся встрече их обычно не оставляют.

type Existing = {
  metHappened: boolean;
  rating?: number | null;
  comment?: string | null;
} | null;

export default function FeedbackForm({
  requestId,
  side,
  existing,
  onDone,
}: {
  requestId: string;
  side: "STUDENT" | "EXPERT";
  existing: Existing;
  onDone: () => void;
}) {
  const [met, setMet] = useState<boolean | null>(existing ? existing.metHappened : null);
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (existing) {
    return (
      <div className={styles.feedbackDone}>
        Спасибо, ответ записан: встреча {existing.metHappened ? "состоялась" : "не состоялась"}
        {existing.rating ? `, оценка ${existing.rating} из 5` : ""}.
      </div>
    );
  }

  async function submit() {
    if (met === null) {
      setError("Отметьте, состоялась ли встреча");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/expert/requests/${requestId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metHappened: met,
          rating: side === "STUDENT" && rating > 0 ? rating : undefined,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить ответ");
        return;
      }
      onDone();
    } catch {
      setError("Не удалось сохранить ответ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.feedbackBox}>
      <p className={styles.feedbackTitle}>Как прошла консультация?</p>

      <div className={styles.radioRow}>
        <label className={styles.radioLabel}>
          <input type="radio" checked={met === true} onChange={() => setMet(true)} />
          Встреча состоялась
        </label>
        <label className={styles.radioLabel}>
          <input type="radio" checked={met === false} onChange={() => setMet(false)} />
          Встреча не состоялась
        </label>
      </div>

      {side === "STUDENT" && met === true && (
        <>
          <p className={styles.feedbackTitle}>Оцените консультацию</p>
          <div className={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.star} ${rating >= n ? styles.starActive : ""}`}
                onClick={() => setRating(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className={styles.reasonInput}
        rows={3}
        placeholder={
          side === "STUDENT"
            ? "Комментарий — необязательно"
            : "Комментарий — необязательно. Например, был ли студент подготовлен"
        }
      />

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        <button type="button" className={styles.acceptButton} disabled={busy} onClick={submit}>
          {busy ? "Отправляем…" : "Отправить ответ"}
        </button>
      </div>
    </div>
  );
}
