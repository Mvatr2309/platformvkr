"use client";

import { useEffect, useState } from "react";
import FeedbackForm from "../requests/FeedbackForm";
import styles from "../requests/requests.module.css";

// FR-08: исходящие запросы студента (08.13, 08.15).
// Контакт эксперта приходит с сервера только по принятым запросам.

type Req = {
  id: string;
  status: string;
  topic: string;
  expectedResult: string;
  ownProgress: string;
  problemArea: string | null;
  materialsUrl: string | null;
  moderatorComment: string | null;
  expertComment: string | null;
  createdAt: string;
  expertContact: string | null;
  closedWithoutFeedback: boolean;
  feedbacks: { metHappened: boolean; rating: number | null; comment: string | null }[];
  project: { id: string; title: string } | null;
  expert: {
    id: string;
    position: string;
    workplace: string;
    user: { name: string };
  };
};

const STATUS: Record<string, { label: string; cls: string }> = {
  NEW: { label: "На проверке у модератора", cls: "badgeNew" },
  APPROVED_BY_MODERATOR: { label: "Ждём решения эксперта", cls: "badgeWait" },
  REJECTED_BY_MODERATOR: { label: "Отклонён модератором", cls: "badgeNo" },
  REJECTED_BY_EXPERT: { label: "Отклонён экспертом", cls: "badgeNo" },
  CONTACTS_SENT: { label: "Принят, контакты получены", cls: "badgeOk" },
  AWAITING_FEEDBACK: { label: "Ждём вашу обратную связь", cls: "badgeWait" },
  CLOSED: { label: "Закрыт", cls: "badgeMuted" },
};

export default function MyRequests() {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  function load() {
    fetch("/api/expert/requests")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className={styles.wrapper}><p className={styles.empty}>Загружаем…</p></div>;

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Мои запросы</h1>
      <p className={styles.subtitle}>
        Запрос сначала проверяет модератор, затем решение принимает эксперт. Контакты
        появятся здесь, как только эксперт примет запрос.
      </p>

      {items.length === 0 ? (
        <p className={styles.empty}>
          Запросов пока нет. Найдите эксперта в каталоге и отправьте первый.
        </p>
      ) : (
        items.map((r) => {
          const st = STATUS[r.status] || { label: r.status, cls: "badgeMuted" };
          const isOpen = openId === r.id;
          return (
            <div key={r.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardWho}>{r.expert.user.name}</div>
                  <div className={styles.cardMeta}>
                    {[r.expert.position, r.expert.workplace].filter(Boolean).join(", ")}
                  </div>
                  <div className={styles.cardMeta}>
                    Отправлен {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                  </div>
                </div>
                <span className={`${styles.badge} ${styles[st.cls]}`}>{st.label}</span>
              </div>

              {r.status === "AWAITING_FEEDBACK" && (
                <FeedbackForm
                  requestId={r.id}
                  side="STUDENT"
                  existing={r.feedbacks[0] ?? null}
                  onDone={load}
                />
              )}

              {r.status === "CLOSED" && r.closedWithoutFeedback && (
                <div className={styles.reason}>
                  Запрос закрыт автоматически — обратную связь вы не оставили.
                </div>
              )}

              {r.status === "CLOSED" && r.feedbacks[0] && (
                <div className={styles.feedbackDone}>
                  Ваш ответ: встреча {r.feedbacks[0].metHappened ? "состоялась" : "не состоялась"}
                  {r.feedbacks[0].rating ? `, оценка ${r.feedbacks[0].rating} из 5` : ""}.
                </div>
              )}

              {r.expertContact && (
                <div className={styles.contacts}>
                  <strong>Контакт эксперта:</strong> {r.expertContact}
                  <br />
                  Напишите первым и договоритесь о времени.
                </div>
              )}

              {r.moderatorComment && r.status === "REJECTED_BY_MODERATOR" && (
                <div className={styles.reason}>
                  <strong>Причина отклонения модератором:</strong> {r.moderatorComment}
                </div>
              )}

              {r.expertComment && (
                <div className={styles.reason}>
                  <strong>Причина отказа эксперта:</strong> {r.expertComment}
                </div>
              )}

              <button type="button" className={styles.toggle} onClick={() => setOpenId(isOpen ? null : r.id)}>
                {isOpen ? "Свернуть анкету" : "Показать анкету"}
              </button>

              {isOpen && (
                <>
                  <div className={styles.block}>
                    <div className={styles.blockTitle}>Что хочу обсудить</div>
                    <p className={styles.blockText}>{r.topic}</p>
                  </div>
                  <div className={styles.block}>
                    <div className={styles.blockTitle}>Какой результат жду</div>
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
                      <a href={`/projects/${r.project.id}`} className={styles.link}>{r.project.title}</a>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
