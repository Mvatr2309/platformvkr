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

interface ThreadMessage {
  id: string;
  authorRole: "USER" | "ADMIN";
  authorName: string | null;
  text: string;
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

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export default function InquiriesPage() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback?mine=true");
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchThread = useCallback(async (id: string) => {
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/feedback/${id}/messages`);
      if (res.ok) setThread(await res.json());
    } catch { /* ignore */ }
    setThreadLoading(false);
  }, []);

  function toggleOpen(id: string) {
    if (openId === id) {
      setOpenId(null);
      setThread([]);
      setReply("");
    } else {
      setOpenId(id);
      setReply("");
      fetchThread(id);
    }
  }

  async function sendReply(id: string) {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await fetch(`/api/feedback/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        setReply("");
        await fetchThread(id);
      }
    } catch { /* ignore */ }
    setSending(false);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Мои обращения</h1>
        <p className={styles.hint}>
          Здесь сохраняются обращения, которые вы отправили через кнопку «Обратная связь», и переписка с командой разработки.
        </p>

        {loading ? (
          <p className={styles.empty}>Загрузка...</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>
            Вы ещё не отправляли обращений. Кнопка «Обратная связь» в боковом меню или в правом нижнем углу.
          </p>
        ) : (
          <div className={styles.list}>
            {items.map((it) => {
              const isOpen = openId === it.id;
              return (
                <div key={it.id} className={styles.card}>
                  <div className={styles.cardHeader} onClick={() => toggleOpen(it.id)} style={{ cursor: "pointer" }}>
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

                  <div className={styles.preview}>
                    {it.message.length > 200 ? it.message.slice(0, 200) + "…" : it.message}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleOpen(it.id)}
                    className={styles.toggleBtn}
                  >
                    {isOpen ? "Свернуть переписку" : "Открыть переписку"}
                  </button>

                  {isOpen && (
                    <div className={styles.thread}>
                      {threadLoading ? (
                        <p className={styles.empty}>Загрузка переписки...</p>
                      ) : (
                        <>
                          {thread.map((m) => (
                            <div
                              key={m.id}
                              className={`${styles.message} ${m.authorRole === "USER" ? styles.messageUser : styles.messageAdmin}`}
                            >
                              <div className={styles.messageMeta}>
                                {m.authorRole === "USER" ? "Вы" : (m.authorName || "Команда разработки")}
                                <span className={styles.messageDate}>· {formatDateTime(m.createdAt)}</span>
                              </div>
                              <div className={styles.messageText}>{m.text}</div>
                            </div>
                          ))}

                          {it.status === "RESOLVED" && (
                            <div className={styles.resolvedHint}>
                              Обращение закрыто. Если вопрос не решён — отправьте новое сообщение, обращение откроется снова.
                            </div>
                          )}

                          <div className={styles.replyBox}>
                            <textarea
                              value={isOpen ? reply : ""}
                              onChange={(e) => setReply(e.target.value)}
                              rows={3}
                              placeholder="Напишите сообщение..."
                              className={styles.replyTextarea}
                              disabled={sending}
                            />
                            <button
                              type="button"
                              onClick={() => sendReply(it.id)}
                              disabled={sending || !reply.trim()}
                              className={styles.replyBtn}
                            >
                              {sending ? "Отправка..." : "Отправить"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
