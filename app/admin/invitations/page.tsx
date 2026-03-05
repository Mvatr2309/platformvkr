"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./invitations.module.css";

interface Invitation {
  id: string;
  name: string;
  email: string;
  status: "SENT" | "ACCEPTED" | "EXPIRED";
  createdAt: string;
  sentBy: { name: string };
}

const STATUS_LABELS: Record<string, string> = {
  SENT: "Отправлено",
  ACCEPTED: "Принято",
  EXPIRED: "Истекло",
};

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchInvitations = useCallback(async () => {
    const res = await fetch("/api/admin/invitations");
    if (res.ok) {
      setInvitations(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка отправки");
        return;
      }

      setSuccess(`Приглашение отправлено: ${email}`);
      setName("");
      setEmail("");
      fetchInvitations();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(id: string) {
    const res = await fetch(`/api/admin/invitations/${id}/resend`, {
      method: "POST",
    });

    if (res.ok) {
      setSuccess("Приглашение отправлено повторно");
    } else {
      const data = await res.json();
      setError(data.error || "Ошибка повторной отправки");
    }
  }

  return (
    <div>
      <h1 className={styles.title}>Приглашения научных руководителей</h1>

      {/* Форма отправки приглашения */}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.label}>ФИО</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              className={styles.input}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivanov@mipt.ru"
              className={styles.input}
              required
            />
          </div>
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Отправка..." : "Отправить приглашение"}
          </button>
        </div>
      </form>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      {/* Таблица приглашений */}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ФИО</th>
            <th>E-mail</th>
            <th>Статус</th>
            <th>Дата</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {invitations.length === 0 && (
            <tr>
              <td colSpan={5} className={styles.empty}>
                Приглашений пока нет
              </td>
            </tr>
          )}
          {invitations.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.name}</td>
              <td>{inv.email}</td>
              <td>
                <span className={`${styles.status} ${styles[`status_${inv.status}`]}`}>
                  {STATUS_LABELS[inv.status]}
                </span>
              </td>
              <td>{new Date(inv.createdAt).toLocaleDateString("ru-RU")}</td>
              <td>
                {inv.status === "SENT" && (
                  <button
                    onClick={() => handleResend(inv.id)}
                    className={styles.resendButton}
                  >
                    Отправить повторно
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
