"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "./calendar.module.css";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  eventType: "DEADLINE" | "DEFENSE" | "CONSULTATION" | "OTHER";
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
    case "DEADLINE": return styles.chipDeadline;
    case "DEFENSE": return styles.chipDefense;
    case "CONSULTATION": return styles.chipConsultation;
    default: return styles.chipOther;
  }
}

export default function CalendarPage() {
  const { data: session } = useSession();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filterType, setFilterType] = useState("");
  const [filterDirection, setFilterDirection] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    eventType: "DEADLINE",
    direction: "",
    projectId: "",
  });

  const fetchEvents = useCallback(async () => {
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const params = new URLSearchParams({ month: monthStr });
    if (filterType) params.set("eventType", filterType);
    if (filterDirection) params.set("direction", filterDirection);

    const res = await fetch(`/api/events?${params}`);
    if (res.ok) {
      setEvents(await res.json());
    }
  }, [year, month, filterType, filterDirection]);

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

  // Build calendar grid
  function buildDays() {
    const firstDay = new Date(year, month, 1);
    // Monday = 0, Sunday = 6
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { date: Date; current: boolean }[] = [];

    // Previous month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), current: false });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(year, month, d), current: true });
    }

    // Next month padding (fill to 42 cells = 6 weeks)
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
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMessage("");

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        projectId: form.projectId || null,
        direction: form.direction || null,
      }),
    });

    if (res.ok) {
      setMessage("Событие создано");
      setShowCreate(false);
      setForm({ title: "", description: "", date: "", eventType: "DEADLINE", direction: "", projectId: "" });
      fetchEvents();
    } else {
      const data = await res.json();
      setError(data.error || "Ошибка");
    }
  }

  const canCreate = session?.user?.role === "ADMIN";
  const days = buildDays();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Календарь событий</h1>

      {message && <p className={styles.success}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.toolbar}>
        <div className={styles.monthNav}>
          <button onClick={prevMonth} className={styles.navBtn}>&larr;</button>
          <span className={styles.monthLabel}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className={styles.navBtn}>&rarr;</button>
          <button onClick={goToday} className={styles.todayBtn}>Сегодня</button>
        </div>

        <div className={styles.filters}>
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
            <option value="">Все направления</option>
            <option value="ПМИ">ПМИ</option>
            <option value="ПМФ">ПМФ</option>
            <option value="РЛ">РЛ</option>
            <option value="БМ">БМ</option>
            <option value="КИ">КИ</option>
          </select>

          <a
            href={`/api/events/ical${filterDirection ? `?direction=${filterDirection}` : ""}`}
            className={styles.todayBtn}
          >
            Экспорт iCal
          </a>

          {canCreate && (
            <button onClick={() => setShowCreate(true)} className={styles.createBtn}>
              + Событие
            </button>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className={styles.calendarGrid}>
        {DAY_NAMES.map((d) => (
          <div key={d} className={styles.dayHeader}>{d}</div>
        ))}

        {days.map((day, idx) => {
          const dayEvents = eventsForDate(day.date);
          const cellClass = [
            styles.dayCell,
            !day.current ? styles.otherMonth : "",
            isToday(day.date) ? styles.today : "",
          ].filter(Boolean).join(" ");

          return (
            <div key={idx} className={cellClass}>
              <div className={styles.dayNumber}>{day.date.getDate()}</div>
              {dayEvents.slice(0, 3).map((ev) => (
                <div
                  key={ev.id}
                  className={`${styles.eventChip} ${chipClass(ev.eventType)}`}
                  onClick={() => setSelectedEvent(ev)}
                  title={ev.title}
                >
                  {ev.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className={styles.moreChip}>+{dayEvents.length - 3}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Новое событие</h3>
            <form onSubmit={handleCreate}>
              <div className={styles.formGroup}>
                <label>Название</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Дата</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Тип события</label>
                <select
                  value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                >
                  {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Направление (опционально)</label>
                <select
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="ПМИ">ПМИ</option>
                  <option value="ПМФ">ПМФ</option>
                  <option value="РЛ">РЛ</option>
                  <option value="БМ">БМ</option>
                  <option value="КИ">КИ</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Описание</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className={styles.formActions}>
                <button type="button" onClick={() => setShowCreate(false)} className={styles.cancelBtn}>
                  Отмена
                </button>
                <button type="submit" className={styles.submitBtn}>Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event detail modal */}
      {selectedEvent && (
        <div className={styles.overlay} onClick={() => setSelectedEvent(null)}>
          <div className={styles.eventDetail} onClick={(e) => e.stopPropagation()}>
            <div className={`${styles.eventChip} ${chipClass(selectedEvent.eventType)}`} style={{ display: "inline-block", marginBottom: 12 }}>
              {EVENT_TYPE_LABELS[selectedEvent.eventType]}
            </div>
            <h3 className={styles.eventDetailTitle}>{selectedEvent.title}</h3>
            <div className={styles.eventDetailMeta}>
              {new Date(selectedEvent.date).toLocaleDateString("ru-RU", {
                day: "numeric", month: "long", year: "numeric",
              })}
              {selectedEvent.direction && ` · ${selectedEvent.direction}`}
            </div>
            {selectedEvent.description && (
              <p className={styles.eventDetailDesc}>{selectedEvent.description}</p>
            )}
            {selectedEvent.project && (
              <a href={`/projects/${selectedEvent.project.id}`} className={styles.eventDetailLink}>
                Проект: {selectedEvent.project.title}
              </a>
            )}
            <br />
            <button onClick={() => setSelectedEvent(null)} className={styles.closeBtn}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}
