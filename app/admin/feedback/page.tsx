"use client";

import { useState, useEffect, useCallback } from "react";
import Pagination, { usePagination } from "@/components/Pagination";
import styles from "../invitations/invitations.module.css";

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

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Студент",
  SUPERVISOR: "НР",
  ADMIN: "Админ",
};

interface FeedbackItem {
  id: string;
  category: string;
  message: string;
  status: string;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  user: { name: string; email: string; role: string };
}

interface ThreadMessage {
  id: string;
  authorRole: "USER" | "ADMIN";
  authorName: string | null;
  text: string;
  createdAt: string;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const fetchFeedback = useCallback(async () => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/feedback?${params}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [categoryFilter, statusFilter]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

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

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/feedback/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) fetchFeedback();
  }

  async function sendReply(id: string, alsoResolve: boolean) {
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
        if (alsoResolve) {
          await fetch(`/api/feedback/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "RESOLVED" }),
          });
        }
        setReply("");
        await fetchThread(id);
        await fetchFeedback();
      }
    } catch { /* ignore */ }
    setSending(false);
  }

  const { page, setPage, totalPages, paged } = usePagination(items, 20);

  useEffect(() => { setPage(1); }, [categoryFilter, statusFilter, setPage]);

  if (loading) return <div><p>Загрузка...</p></div>;

  return (
    <div>
      <h1 className={styles.title}>Обратная связь</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #ddd", fontFamily: "inherit", fontSize: 14 }}
        >
          <option value="">Все категории</option>
          <option value="BUG">Баг</option>
          <option value="SUGGESTION">Предложение</option>
          <option value="QUESTION">Вопрос</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #ddd", fontFamily: "inherit", fontSize: 14 }}
        >
          <option value="">Все статусы</option>
          <option value="NEW">Новое</option>
          <option value="IN_PROGRESS">В работе</option>
          <option value="RESOLVED">Решено</option>
        </select>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>Обращений пока нет</p>
      ) : (
        <>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {paged.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div key={item.id} style={{ background: "#fff", border: "1px solid #ddd", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{
                      padding: "2px 8px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: item.category === "BUG" ? "#fde8ec" : item.category === "SUGGESTION" ? "#e8f0fd" : "#f0f0f0",
                      color: item.category === "BUG" ? "#E8375A" : item.category === "SUGGESTION" ? "#003092" : "#555",
                    }}>
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <strong style={{ fontSize: 14 }}>{item.user.name || item.user.email}</strong>
                    <span style={{ fontSize: 12, color: "#888" }}>· {ROLE_LABELS[item.user.role] || item.user.role}</span>
                    <span style={{ fontSize: 12, color: "#888" }}>· {item.user.email}</span>
                  </div>
                  <span style={{ fontSize: 13, color: "#888" }}>
                    {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>

                <div style={{ fontSize: 14, marginBottom: 12, whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#555" }}>
                  {item.message.length > 200 ? item.message.slice(0, 200) + "…" : item.message}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => toggleOpen(item.id)}
                    style={{ padding: "6px 14px", background: "#003092", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {isOpen ? "Свернуть" : "Открыть переписку"}
                  </button>
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                    style={{
                      padding: "6px 10px",
                      border: "1px solid #ddd",
                      fontFamily: "inherit",
                      fontSize: 13,
                      background: item.status === "RESOLVED" ? "#e8f5e9" : item.status === "IN_PROGRESS" ? "#fff8e1" : "#fff",
                    }}
                  >
                    <option value="NEW">Новое</option>
                    <option value="IN_PROGRESS">В работе</option>
                    <option value="RESOLVED">Решено</option>
                  </select>
                  <span style={{ fontSize: 12, color: "#888" }}>{STATUS_LABELS[item.status]}</span>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eee", display: "flex", flexDirection: "column", gap: 12 }}>
                    {threadLoading ? (
                      <p style={{ color: "#888", fontSize: 13 }}>Загрузка переписки...</p>
                    ) : (
                      <>
                        {thread.map((m) => (
                          <div
                            key={m.id}
                            style={{
                              padding: "10px 14px",
                              maxWidth: "80%",
                              whiteSpace: "pre-wrap",
                              fontSize: 14,
                              lineHeight: 1.5,
                              alignSelf: m.authorRole === "USER" ? "flex-start" : "flex-end",
                              background: m.authorRole === "USER" ? "rgba(232, 55, 90, 0.08)" : "#f0f4ff",
                              borderLeft: `3px solid ${m.authorRole === "USER" ? "#E8375A" : "#003092"}`,
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: m.authorRole === "USER" ? "#E8375A" : "#003092" }}>
                              {m.authorRole === "USER" ? (item.user.name || item.user.email) : (m.authorName || "Команда разработки")}
                              <span style={{ fontWeight: 400, color: "#888", marginLeft: 4 }}>· {formatDateTime(m.createdAt)}</span>
                            </div>
                            <div>{m.text}</div>
                          </div>
                        ))}

                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                          <textarea
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            rows={3}
                            placeholder="Ответ пользователю..."
                            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", fontFamily: "inherit", fontSize: 14, resize: "vertical" }}
                            disabled={sending}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => sendReply(item.id, false)}
                              disabled={sending || !reply.trim()}
                              style={{ padding: "8px 16px", background: "#003092", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: sending ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: sending ? 0.5 : 1 }}
                            >
                              Отправить
                            </button>
                            <button
                              onClick={() => sendReply(item.id, true)}
                              disabled={sending || !reply.trim()}
                              style={{ padding: "8px 16px", background: "#2e7d32", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: sending ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: sending ? 0.5 : 1 }}
                            >
                              Отправить и закрыть
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
