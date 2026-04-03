"use client";

import { useState, useEffect, useCallback } from "react";
import listStyles from "../list.module.css";
import cal from "./calendar-admin.module.css";

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

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function chipClass(type: string) {
  switch (type) {
    case "DEADLINE": return cal.chipDeadline;
    case "DEFENSE": return cal.chipDefense;
    case "CONSULTATION": return cal.chipConsultation;
    default: return cal.chipOther;
  }
}

export default function AdminCalendarPage() {
  const today = new Date();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filterType, setFilterType] = useState("");
  const [filterDirection, setFilterDirection] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("calendar");

  // Month navigation (for calendar view)
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

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

  // Event detail popup (calendar view)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType) params.set("eventType", filterType);
    if (filterDirection) params.set("direction", filterDirection);
    if (view === "calendar") {
      const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
      params.set("month", monthStr);
    }

    const res = await fetch(`/api/events?${params}`);
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  }, [filterType, filterDirection, view, year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

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
    setSelectedEvent(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMessage("");

    if (!form.title || !form.date || !form.eventType) {
      setError("Заполните название, дату и тип");
      return;
    }

    const payload = { ...form, direction: form.direction || null };
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
      setSelectedEvent(null);
      fetchEvents();
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric", month: "short", year: "numeric",
    });
  }

  // Build calendar grid
  function buildDays() {
    const firstDay = new Date(year, month, 1);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const days: { date: Date; current: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), current: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(year, month, d), current: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), current: false });
    }
    return days;
  }

  function eventsForDate(date: Date) {
    const dateStr = date.toISOString().split("T")[0];
    return events.filter((e) => e.date.split("T")[0] === dateStr);
  }

  function isToday(date: Date) {
    return date.getDate() === today.getDate()
      && date.getMonth() === today.getMonth()
      && date.getFullYear() === today.getFullYear();
  }

  if (loading) return <div><p>Загрузка...</p></div>;

  return (
    <div>
      <h1 className={listStyles.title}>Календарь событий</h1>

      {message && <p style={{ color: "#2a7d2a", marginBottom: 16, fontSize: 14 }}>{message}</p>}

      <div className={listStyles.controls}>
        {/* View toggle */}
        <div className={cal.viewToggle}>
          <button
            className={`${cal.viewBtn} ${view === "calendar" ? cal.viewBtnActive : ""}`}
            onClick={() => setView("calendar")}
          >
            Календарь
          </button>
          <button
            className={`${cal.viewBtn} ${view === "list" ? cal.viewBtnActive : ""}`}
            onClick={() => setView("list")}
          >
            Список
          </button>
        </div>

        {/* Month nav (only in calendar view) */}
        {view === "calendar" && (
          <div className={cal.monthNav}>
            <button onClick={prevMonth} className={cal.navBtn}>&larr;</button>
            <span className={cal.monthLabel}>{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} className={cal.navBtn}>&rarr;</button>
            <button onClick={goToday} className={cal.todayBtn}>Сегодня</button>
          </div>
        )}

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className={listStyles.filterSelect}
        >
          <option value="">Все типы</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value)}
          className={listStyles.filterSelect}
        >
          <option value="">Все магистратуры</option>
          <option value="ПМИ">ПМИ</option>
          <option value="ПМФ">ПМФ</option>
          <option value="РЛ">РЛ</option>
          <option value="БМ">БМ</option>
          <option value="КИ">КИ</option>
        </select>

        <span className={listStyles.count}>Всего: {events.length}</span>

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

      {/* === CALENDAR VIEW === */}
      {view === "calendar" && (
        <>
          <div className={cal.calendarGrid}>
            {DAY_NAMES.map((d) => (
              <div key={d} className={cal.dayHeader}>{d}</div>
            ))}
            {buildDays().map((day, idx) => {
              const dayEvents = eventsForDate(day.date);
              const cellClass = [
                cal.dayCell,
                !day.current ? cal.otherMonth : "",
                isToday(day.date) ? cal.today : "",
              ].filter(Boolean).join(" ");

              return (
                <div key={idx} className={cellClass}>
                  <div className={cal.dayNumber}>{day.date.getDate()}</div>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className={`${cal.eventChip} ${chipClass(ev.eventType)}`}
                      onClick={() => setSelectedEvent(ev)}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className={cal.moreChip}>+{dayEvents.length - 3}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Event detail popup */}
          {selectedEvent && (
            <div className={cal.overlay} onClick={() => setSelectedEvent(null)}>
              <div className={cal.eventDetail} onClick={(e) => e.stopPropagation()}>
                <div className={`${cal.eventChip} ${chipClass(selectedEvent.eventType)}`} style={{ display: "inline-block", marginBottom: 12 }}>
                  {EVENT_TYPE_LABELS[selectedEvent.eventType]}
                </div>
                <h3 className={cal.eventDetailTitle}>{selectedEvent.title}</h3>
                <div className={cal.eventDetailMeta}>
                  {new Date(selectedEvent.date).toLocaleDateString("ru-RU", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                  {selectedEvent.direction && ` · ${selectedEvent.direction}`}
                </div>
                {selectedEvent.description && (
                  <p className={cal.eventDetailDesc}>{selectedEvent.description}</p>
                )}
                {selectedEvent.project && (
                  <a href={`/projects/${selectedEvent.project.id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-deep-blue)" }}>
                    Проект: {selectedEvent.project.title}
                  </a>
                )}
                <div className={cal.eventDetailActions}>
                  <button onClick={() => openEdit(selectedEvent)} className={cal.editBtn}>Изменить</button>
                  <button onClick={() => handleDelete(selectedEvent.id)} className={cal.deleteBtn}>Удалить</button>
                  <button onClick={() => setSelectedEvent(null)} className={cal.closeBtn}>Закрыть</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* === LIST VIEW === */}
      {view === "list" && (
        <div className={listStyles.tableWrap}>
          <table className={listStyles.table}>
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
                <tr><td colSpan={6} className={listStyles.empty}>Нет событий</td></tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(ev.date)}</td>
                    <td style={{ fontWeight: 500 }}>{ev.title}</td>
                    <td>
                      <span className={listStyles.tag}>{EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}</span>
                    </td>
                    <td>{ev.direction || <span className={listStyles.muted}>—</span>}</td>
                    <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ev.description || <span className={listStyles.muted}>—</span>}
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
      )}
    </div>
  );
}
