"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "../requests/requests.module.css";

// FR-08: очередь модерации запросов (08.13).
// Модератор — существующая роль ADMIN. При отклонении причина обязательна.

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
  directionSnapshot: string;
  courseSnapshot: number;
  createdAt: string;
  project: { id: string; title: string } | null;
  student: { user: { name: string } };
  expert: { position: string; workplace: string; user: { name: string } };
};

const STATUS: Record<string, { label: string; cls: string }> = {
  NEW: { label: "Новый", cls: "badgeNew" },
  APPROVED_BY_MODERATOR: { label: "Одобрен, ждёт эксперта", cls: "badgeWait" },
  REJECTED_BY_MODERATOR: { label: "Отклонён вами", cls: "badgeNo" },
  REJECTED_BY_EXPERT: { label: "Отклонён экспертом", cls: "badgeNo" },
  CONTACTS_SENT: { label: "Принят, контакты отправлены", cls: "badgeOk" },
  AWAITING_FEEDBACK: { label: "Ждём обратную связь", cls: "badgeWait" },
  CLOSED: { label: "Закрыт", cls: "badgeMuted" },
};

export default function ModerationQueue() {
  const [items, setItems] = useState<Req[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"NEW" | "ALL">("NEW");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/expert/admin/requests?status=${tab}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.requests || []);
        setCounts(data.counts || {});
      }
    } catch {
      /* пусто */
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/expert/admin/requests/${id}/moderate`, {
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

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Модерация запросов</h1>
      <p className={styles.subtitle}>
        Проверьте запрос перед передачей эксперту. При отклонении причина обязательна —
        студент увидит её в своём кабинете.
      </p>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === "NEW" ? styles.tabActive : ""}`}
          onClick={() => setTab("NEW")}
        >
          Новые{counts.NEW ? ` (${counts.NEW})` : ""}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === "ALL" ? styles.tabActive : ""}`}
          onClick={() => setTab("ALL")}
        >
          Все запросы
        </button>
      </div>

      {loading ? (
        <p className={styles.empty}>Загружаем…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>
          {tab === "NEW" ? "Новых запросов нет — очередь пуста." : "Запросов пока нет."}
        </p>
      ) : (
        items.map((r) => {
          const st = STATUS[r.status] || { label: r.status, cls: "badgeMuted" };
          return (
            <div key={r.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardWho}>
                    {r.student.user.name} → {r.expert.user.name}
                  </div>
                  <div className={styles.cardMeta}>
                    Студент: {r.directionSnapshot || "программа не указана"}, {r.courseSnapshot} курс
                  </div>
                  <div className={styles.cardMeta}>
                    Эксперт: {[r.expert.position, r.expert.workplace].filter(Boolean).join(", ")}
                  </div>
                  <div className={styles.cardMeta}>
                    Отправлен {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                  </div>
                </div>
                <span className={`${styles.badge} ${styles[st.cls]}`}>{st.label}</span>
              </div>

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
                  <a href={`/projects/${r.project.id}`} className={styles.link}>{r.project.title}</a>
                </div>
              )}

              {r.moderatorComment && (
                <div className={styles.reason}>
                  <strong>Комментарий модератора:</strong> {r.moderatorComment}
                </div>
              )}
              {r.expertComment && (
                <div className={styles.reason}>
                  <strong>Причина отказа эксперта:</strong> {r.expertComment}
                </div>
              )}

              {r.status === "NEW" && (
                <>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.acceptButton}
                      disabled={busy === r.id}
                      onClick={() => decide(r.id, "approve")}
                    >
                      {busy === r.id ? "Сохраняем…" : "Одобрить и передать эксперту"}
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

                  {rejecting === r.id && (
                    <>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className={styles.reasonInput}
                        rows={3}
                        placeholder="Причина отклонения — студент её увидит"
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
                </>
              )}

              {error && rejecting === r.id && <div className={styles.error}>{error}</div>}
            </div>
          );
        })
      )}
    </div>
  );
}
