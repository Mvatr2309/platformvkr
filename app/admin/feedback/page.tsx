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

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchFeedback = useCallback(async () => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/feedback?${params}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [categoryFilter, statusFilter]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/feedback/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) fetchFeedback();
  }

  function openResponse(item: FeedbackItem) {
    setRespondingId(item.id);
    setResponseText(item.response || "");
  }

  async function saveResponse(id: string, alsoResolve: boolean) {
    const text = responseText.trim();
    if (!text) return;
    setSaving(true);
    const body: Record<string, string> = { response: text };
    if (alsoResolve) body.status = "RESOLVED";
    const res = await fetch(`/api/feedback/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      setRespondingId(null);
      setResponseText("");
      fetchFeedback();
    }
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
          {paged.map((item) => (
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

              <div style={{ fontSize: 14, marginBottom: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {item.message}
              </div>

              {item.response && respondingId !== item.id && (
                <div style={{ background: "#f0f4ff", borderLeft: "3px solid #003092", padding: "8px 12px", marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#003092", marginBottom: 4 }}>
                    Ответ
                    {item.respondedAt && (
                      <span style={{ fontWeight: 400, color: "#888", marginLeft: 4 }}>
                        · {new Date(item.respondedAt).toLocaleDateString("ru-RU")}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{item.response}</div>
                </div>
              )}

              {respondingId === item.id ? (
                <div>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={4}
                    placeholder="Ответ пользователю..."
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", fontFamily: "inherit", fontSize: 14, resize: "vertical", marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => saveResponse(item.id, false)}
                      disabled={saving || !responseText.trim()}
                      style={{ padding: "8px 16px", background: "#003092", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Отправить ответ
                    </button>
                    <button
                      onClick={() => saveResponse(item.id, true)}
                      disabled={saving || !responseText.trim()}
                      style={{ padding: "8px 16px", background: "#2e7d32", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Ответить и закрыть
                    </button>
                    <button
                      onClick={() => { setRespondingId(null); setResponseText(""); }}
                      style={{ padding: "8px 16px", background: "none", border: "1px solid #ddd", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => openResponse(item)}
                    style={{ padding: "6px 14px", background: "#003092", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {item.response ? "Изменить ответ" : "Ответить"}
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
              )}
            </div>
          ))}
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
