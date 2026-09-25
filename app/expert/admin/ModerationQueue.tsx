"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "../requests/requests.module.css";

// FR-08: очередь модерации запросов (08.13, M1).
// Модератор — существующая роль ADMIN. Три действия: одобрить (комментарий по желанию),
// вернуть на доработку и отклонить (комментарий обязателен). Комментарий видит студент.
// Запрос на доработке можно только отклонить — чтобы он не застревал. С решением уходит
// updatedAt карточки: сервер откажет, если студент успел переписать анкету.

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
  updatedAt: string;
  project: { id: string; title: string } | null;
  student: { user: { name: string } };
  expert: { position: string; workplace: string; user: { name: string } };
};

const STATUS: Record<string, { label: string; cls: string }> = {
  NEW: { label: "Новый", cls: "badgeNew" },
  NEEDS_REVISION: { label: "На доработке у студента", cls: "badgeWait" },
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
  // Комментарий и ошибка — свои у каждой карточки: ошибка видна при любом действии
  const [comments, setComments] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // silent — перезагрузка после решения: без экрана «Загружаем…», прокрутка не сбрасывается
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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

  async function decide(r: Req, action: "approve" | "return" | "reject") {
    const id = r.id;
    const comment = (comments[id] || "").trim();
    if (action !== "approve" && !comment) {
      setErrors((e) => ({
        ...e,
        [id]:
          action === "return"
            ? "Напишите комментарий — студент увидит, что исправить"
            : "Напишите причину отклонения — студент её увидит",
      }));
      return;
    }
    setBusy(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      const res = await fetch(`/api/expert/admin/requests/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment, updatedAt: r.updatedAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [id]: data.error || "Не удалось сохранить решение" }));
        // Запрос мог измениться — подтягиваем актуальное состояние карточки
        if (res.status === 409) await load(true);
        return;
      }
      setComments((c) => ({ ...c, [id]: "" }));
      await load(true);
    } catch {
      setErrors((e) => ({ ...e, [id]: "Не удалось сохранить решение" }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Модерация запросов</h1>
      <p className={styles.subtitle}>
        Проверьте запрос перед передачей эксперту. Комментарий увидит студент: при одобрении
        он по желанию, при возврате на доработку и отклонении обязателен.
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
                    {r.status === "NEW" && r.moderatorComment &&
                      `, исправлен ${new Date(r.updatedAt).toLocaleDateString("ru-RU")}`}
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

              {r.moderatorComment && r.status === "NEW" && (
                <div className={styles.revision}>
                  <strong>Запрос исправлен после доработки. Прошлый комментарий:</strong>{" "}
                  {r.moderatorComment}
                </div>
              )}
              {r.moderatorComment && r.status === "NEEDS_REVISION" && (
                <div className={styles.revision}>
                  <strong>Вернули на доработку:</strong> {r.moderatorComment}
                </div>
              )}
              {r.moderatorComment && r.status === "REJECTED_BY_MODERATOR" && (
                <div className={styles.reason}>
                  <strong>Причина отклонения:</strong> {r.moderatorComment}
                </div>
              )}
              {r.moderatorComment &&
                !["NEW", "NEEDS_REVISION", "REJECTED_BY_MODERATOR"].includes(r.status) && (
                  <div className={styles.moderatorNote}>
                    <strong>Комментарий при одобрении:</strong> {r.moderatorComment}
                  </div>
                )}
              {r.expertComment && (
                <div className={styles.reason}>
                  <strong>Причина отказа эксперта:</strong> {r.expertComment}
                </div>
              )}

              {(r.status === "NEW" || r.status === "NEEDS_REVISION") && (
                <>
                  <textarea
                    value={comments[r.id] || ""}
                    onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                    className={styles.reasonInput}
                    rows={3}
                    aria-label="Комментарий модератора для студента"
                    aria-invalid={Boolean(errors[r.id])}
                    aria-describedby={errors[r.id] ? `moderation-error-${r.id}` : undefined}
                    placeholder={
                      r.status === "NEW"
                        ? "Комментарий для студента. При одобрении — по желанию, при возврате и отклонении — обязательно"
                        : "Причина отклонения — студент её увидит. Например: запрос давно не исправлен"
                    }
                  />
                  <div className={styles.actions}>
                    {r.status === "NEW" && (
                      <>
                        <button
                          type="button"
                          className={styles.acceptButton}
                          disabled={busy === r.id}
                          onClick={() => decide(r, "approve")}
                        >
                          {busy === r.id ? "Сохраняем…" : "Одобрить и передать эксперту"}
                        </button>
                        <button
                          type="button"
                          className={styles.rejectButton}
                          disabled={busy === r.id}
                          onClick={() => decide(r, "return")}
                        >
                          Вернуть на доработку
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className={styles.rejectButton}
                      disabled={busy === r.id}
                      onClick={() => decide(r, "reject")}
                    >
                      Отклонить
                    </button>
                  </div>
                </>
              )}

              {errors[r.id] && (
                <div id={`moderation-error-${r.id}`} role="alert" className={styles.error}>
                  {errors[r.id]}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
