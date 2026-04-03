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
  createdAt: string;
  user: { name: string; email: string; role: string };
}

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Пользователь</th>
              <th>Роль</th>
              <th>Категория</th>
              <th>Сообщение</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((item) => (
              <tr key={item.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                </td>
                <td>
                  <div>{item.user.name}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{item.user.email}</div>
                </td>
                <td>{ROLE_LABELS[item.user.role] || item.user.role}</td>
                <td>
                  <span style={{
                    padding: "2px 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: item.category === "BUG" ? "#fde8ec" : item.category === "SUGGESTION" ? "#e8f0fd" : "#f0f0f0",
                    color: item.category === "BUG" ? "#E8375A" : item.category === "SUGGESTION" ? "#003092" : "#555",
                  }}>
                    {CATEGORY_LABELS[item.category]}
                  </span>
                </td>
                <td style={{ maxWidth: 300 }}>{item.message}</td>
                <td>
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                    style={{
                      padding: "4px 8px",
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
