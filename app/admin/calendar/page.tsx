"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../list.module.css";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  eventType: string;
  direction: string | null;
  projectId: string | null;
  project: { id: string; title: string } | null;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  DEADLINE: "Дедлайн",
  DEFENSE: "Защита",
  CONSULTATION: "Консультация",
  OTHER: "Другое",
};

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filterType, setFilterType] = useState("");
  const [filterDirection, setFilterDirection] = useState("");
  const [loading, setLoading] = useState(true);

  // Create/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    eventType: "DEADLINE",
    direction: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType) params.set("eventType", filterType);
    if (filterDirection) params.set("direction", filterDirection);

    const res = await fetch(`/api/events?${params}`);
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  }, [filterType, filterDirection]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  function openCreate() {
    setEditingId(null);
    setForm({ title: "", description: "", date: "", eventType: "DEADLINE", direction: "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(ev: CalendarEvent) {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description || "",
      date: ev.date.split("T")[0],
      eventType: ev.eventType,
      direction: ev.direction || "",
    });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMessage("");

    if (!form.title || !form.date || !form.eventType) {
      setError("Заполните название, дату и тип");
      return;
    }

    const payload = {
      ...form,
      direction: form.direction || null,
    };

    const url = editingId ? `/api/events/${editingId}` : "/api/events";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setMessage(editingId ? "Событие обновлено" : "Событие создано");
      setShowForm(false);
      fetchEvents();
    } else {
      const data = await res.json();
      setError(data.error || "Ошибка");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить событие?")) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMessage("Событие удалено");
      fetchEvents();
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric", month: "short", year: "numeric",
    });
  }

  if (loading) return <div><p>Загрузка...</p></div>;

  return (
    <div>
      <h1 className={styles.title}>Календарь событий</h1>

      {message && <p style={{ color: "#2a7d2a", marginBottom: 16, fontSize: 14 }}>{message}</p>}

      <div className={styles.controls}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">Все типы</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">Все магистратуры</option>
          <option value="ПМИ">ПМИ</option>
          <option value="ПМФ">ПМФ</option>
          <option value="РЛ">РЛ</option>
          <option value="БМ">БМ</option>
          <option value="КИ">КИ</option>
        </select>

        <span className={styles.count}>Всего: {events.length}</span>

        <button
          onClick={openCreate}
          style={{
            padding: "8px 20px",
            background: "var(--color-coral)",
            color: "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          + Добавить событие
        </button>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          padding: 24,
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            {editingId ? "Редактировать событие" : "Новое событие"}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 500 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Название *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--color-border)", fontSize: 14, fontFamily: "inherit" }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Дата *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                style={{ padding: "8px 12px", border: "1px solid var(--color-border)", fontSize: 14, fontFamily: "inherit" }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Тип события *</label>
              <select
                value={form.eventType}
                onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                style={{ padding: "8px 12px", border: "1px solid var(--color-border)", fontSize: 14, fontFamily: "inherit" }}
              >
                {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Магистратура</label>
              <select
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value })}
                style={{ padding: "8px 12px", border: "1px solid var(--color-border)", fontSize: 14, fontFamily: "inherit" }}
              >
                <option value="">Все магистратуры</option>
                <option value="ПМИ">ПМИ</option>
                <option value="ПМФ">ПМФ</option>
                <option value="РЛ">РЛ</option>
                <option value="БМ">БМ</option>
                <option value="КИ">КИ</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Описание</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--color-border)", fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
              />
            </div>

            {error && <p style={{ color: "var(--color-coral)", fontSize: 13 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                style={{ padding: "10px 24px", background: "var(--color-deep-blue)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                {editingId ? "Сохранить" : "Создать"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ padding: "10px 24px", background: "none", border: "1px solid var(--color-border)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Название</th>
              <th>Тип</th>
              <th>Магистратура</th>
              <th>Описание</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>Нет событий</td></tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(ev.date)}</td>
                  <td style={{ fontWeight: 500 }}>{ev.title}</td>
                  <td>
                    <span className={styles.tag}>{EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}</span>
                  </td>
                  <td>{ev.direction || <span className={styles.muted}>—</span>}</td>
                  <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ev.description || <span className={styles.muted}>—</span>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => openEdit(ev)}
                      style={{ background: "none", border: "none", color: "var(--color-deep-blue)", cursor: "pointer", fontSize: 13, fontWeight: 500, marginRight: 12, fontFamily: "inherit" }}
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      style={{ background: "none", border: "none", color: "var(--color-coral)", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
