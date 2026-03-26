"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

const CATEGORIES = [
  { value: "BUG", label: "Баг" },
  { value: "SUGGESTION", label: "Предложение" },
  { value: "QUESTION", label: "Вопрос" },
];

export default function FeedbackButton() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("BUG");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const role = session?.user?.role;

  // Показываем только студентам и НР, не на лендинге/логине/админке
  if (!role || role === "ADMIN") return null;
  if (pathname === "/" || pathname === "/login" || pathname === "/register") return null;
  if (pathname.startsWith("/admin")) return null;

  async function handleSubmit() {
    if (!message.trim()) {
      setError("Напишите сообщение");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message }),
      });
      if (res.ok) {
        setSuccess(true);
        setMessage("");
        setTimeout(() => { setSuccess(false); setOpen(false); }, 2000);
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(!open); setSuccess(false); setError(""); }}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 48,
          height: 48,
          borderRadius: 0,
          background: "#003092",
          color: "#fff",
          border: "none",
          fontSize: 20,
          cursor: "pointer",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
        title="Обратная связь"
      >
        ?
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 84,
            right: 24,
            width: 340,
            background: "#fff",
            border: "1px solid #ddd",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            zIndex: 1001,
            padding: 20,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, color: "#003092" }}>
            Обратная связь
          </div>

          {success ? (
            <div style={{ color: "#28a745", fontWeight: 600 }}>Спасибо! Сообщение отправлено.</div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Категория</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", fontFamily: "inherit", fontSize: 14 }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Сообщение</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Опишите проблему или предложение..."
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", fontFamily: "inherit", fontSize: 14, resize: "vertical" }}
                />
              </div>

              {error && <div style={{ color: "#E8375A", fontSize: 13, marginBottom: 8 }}>{error}</div>}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleSubmit}
                  disabled={sending}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    background: "#003092",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    fontSize: 14,
                    cursor: sending ? "wait" : "pointer",
                  }}
                >
                  {sending ? "Отправка..." : "Отправить"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    padding: "10px 16px",
                    background: "#f5f5f5",
                    border: "1px solid #ddd",
                    fontFamily: "inherit",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
