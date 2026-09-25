"use client";

import { useEffect, useState } from "react";
import FeedbackForm from "../requests/FeedbackForm";
import styles from "../requests/requests.module.css";

// FR-08: входящие запросы эксперта (08.14, 08.15).
// До решения модератора запросы сюда не попадают. Контакт студента
// приходит с сервера только после принятия.

type Req = {
  id: string;
  status: string;
  topic: string;
  expectedResult: string;
  ownProgress: string;
  problemArea: string | null;
  materialsUrl: string | null;
  expertComment: string | null;
  directionSnapshot: string;
  courseSnapshot: number;
  createdAt: string;
  feedbacks: { metHappened: boolean; comment: string | null }[];
  project: { id: string; title: string } | null;
  student: { name: string; contact: string | null };
};

const STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED_BY_MODERATOR: { label: "Ждёт вашего решения", cls: "badgeWait" },
  REJECTED_BY_EXPERT: { label: "Вы отклонили", cls: "badgeNo" },
  CONTACTS_SENT: { label: "Принят, контакты отправлены", cls: "badgeOk" },
  AWAITING_FEEDBACK: { label: "Ждём обратную связь", cls: "badgeWait" },
  CLOSED: { label: "Закрыт", cls: "badgeMuted" },
};

export default function Inbox() {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/expert/requests");
      const data = res.ok ? await res.json() : [];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      /* пусто */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, action: "accept" | "reject") {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/expert/requests/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: action === "reject" ? reason : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить решение");
        return;
      }
      setRejecting(null);
      setReason("");
      await load();
    } catch {
      setError("Не удалось сохранить решение");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className={styles.wrapper}><p className={styles.empty}>Загружаем…</p></div>;

  const pending = items.filter((r) => r.status === "APPROVED_BY_MODERATOR");
  const rest = items.filter((r) => r.status !== "APPROVED_BY_MODERATOR");

  function card(r: Req, actionable: boolean) {
    const st = STATUS[r.status] || { label: r.status, cls: "badgeMuted" };
    return (
      <div key={r.id} className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardWho}>{r.student.name}</div>
            <div className={styles.cardMeta}>
              {r.directionSnapshot || "программа не указана"}, {r.courseSnapshot} курс
            </div>
            <div className={styles.cardMeta}>
              Отправлен {new Date(r.createdAt).toLocaleDateString("ru-RU")}
            </div>
          </div>
          <span className={`${styles.badge} ${styles[st.cls]}`}>{st.label}</span>
        </div>

        {/* E2: эксперт сразу понимает, что первым пишет студент */}
        {r.student.contact && (
          <div className={styles.contacts}>
            {r.status === "CONTACTS_SENT" && (
              <p className={styles.contactsLead}>
                Вы приняли запрос, и студент получил ваши контакты. Студент напишет вам сам, чтобы
                договориться о времени встречи. Через неделю мы попросим вас оценить, как прошла встреча.
              </p>
            )}
            <strong>Контакт студента:</strong> {r.student.contact}
          </div>
        )}

        <div className={styles.block}>
          <div className={styles.blockTitle}>Что хочет обсудить</div>
          <p className={styles.blockText}>{r.topic}</p>
        </div>
        <div className={styles.block}>
          <div className={styles.blockTitle}>Какой результат ждёт</div>
          <p className={styles.blockText}>{r.expectedResult}</p>
        </div>
        <div className={styles.block}>
          <div className={styles.blockTitle}>Что уже сделал сам</div>
          <p className={styles.blockText}>{r.ownProgress}</p>
        </div>
        {r.problemArea && (
          <div className={styles.block}>
            <div className={styles.blockTitle}>Где возникли проблемы</div>
            <p className={styles.blockText}>{r.problemArea}</p>
          </div>
        )}
        {r.materialsUrl && (
          <div className={styles.block}>
            <div className={styles.blockTitle}>Материалы</div>
            <a href={r.materialsUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
              Открыть папку
            </a>
          </div>
        )}
        {r.project && (
          <div className={styles.block}>
            <div className={styles.blockTitle}>Проект</div>
            <span className={styles.blockText}>{r.project.title}</span>
          </div>
        )}
        {r.expertComment && (
          <div className={styles.reason}>
            <strong>Ваша причина отказа:</strong> {r.expertComment}
          </div>
        )}

        {r.status === "AWAITING_FEEDBACK" && (
          <FeedbackForm
            requestId={r.id}
            side="EXPERT"
            existing={r.feedbacks[0] ?? null}
            onDone={load}
          />
        )}

        {r.status === "CLOSED" && r.feedbacks[0] && (
          <div className={styles.feedbackDone}>
            Ваш ответ: встреча {r.feedbacks[0].metHappened ? "состоялась" : "не состоялась"}.
          </div>
        )}

        {actionable && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.acceptButton}
              disabled={busy === r.id}
              onClick={() => decide(r.id, "accept")}
            >
              {busy === r.id ? "Сохраняем…" : "Принять запрос"}
            </button>
            <button
              type="button"
              className={styles.rejectButton}
              disabled={busy === r.id}
              onClick={() => setRejecting(rejecting === r.id ? null : r.id)}
            >
              Отклонить
            </button>
          </div>
        )}

        {rejecting === r.id && (
          <>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={styles.reasonInput}
              rows={3}
              placeholder="Причина отказа — студент её увидит"
            />
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.acceptButton}
                disabled={busy === r.id || !reason.trim()}
                onClick={() => decide(r.id, "reject")}
              >
                Отправить отказ
              </button>
            </div>
          </>
        )}

        {error && busy === null && rejecting === r.id && <div className={styles.error}>{error}</div>}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Входящие запросы</h1>
      <p className={styles.subtitle}>
        Сюда попадают только запросы, прошедшие проверку модератора. Контакты студента
        откроются после того, как вы примете запрос.
      </p>

      {items.length === 0 ? (
        <p className={styles.empty}>
          Запросов пока нет. Они появятся, когда студенты начнут вам писать.
        </p>
      ) : (
        <>
          {pending.length > 0 && pending.map((r) => card(r, true))}
          {rest.length > 0 && (
            <>
              <h2 className={styles.blockTitle} style={{ marginTop: 32 }}>Обработанные</h2>
              {rest.map((r) => card(r, false))}
            </>
          )}
        </>
      )}
    </div>
  );
}
