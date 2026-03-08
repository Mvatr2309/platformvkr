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

interface CreatedAccount {
  email: string;
  password: string;
  role: string;
}

const STATUS_LABELS: Record<string, string> = {
  SENT: "Отправлено",
  ACCEPTED: "Создан",
  EXPIRED: "Истекло",
};

function downloadCredentials(accounts: CreatedAccount[]) {
  const lines = accounts.map(
    (a) => `${a.role === "STUDENT" ? "Студент" : "НР"}\nЛогин: ${a.email}\nПароль: ${a.password}\n`
  );
  const text = "=== Доступы — Платформа ВКР ===\n\n" + lines.join("\n---\n\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vkr-credentials-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"SUPERVISOR" | "STUDENT">("SUPERVISOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdAccounts, setCreatedAccounts] = useState<CreatedAccount[]>([]);

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
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка создания");
        return;
      }

      const account: CreatedAccount = {
        email,
        password: data.generatedPassword,
        role,
      };

      setCreatedAccounts((prev) => [...prev, account]);
      if (data.emailError) {
        setSuccess(`Аккаунт создан: ${email} (письмо не отправлено: ${data.emailError})`);
      } else {
        setSuccess(`Аккаунт создан и письмо отправлено: ${email}`);
      }
      setEmail("");
      fetchInvitations();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className={styles.title}>Создание аккаунтов</h1>

      {/* Форма создания аккаунта */}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.label}>E-mail (логин)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivanov@mipt.ru"
              className={styles.input}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Роль</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "SUPERVISOR" | "STUDENT")}
              className={styles.input}
            >
              <option value="SUPERVISOR">Научный руководитель</option>
              <option value="STUDENT">Студент</option>
            </select>
          </div>
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Создание..." : "Создать аккаунт"}
          </button>
        </div>
      </form>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      {/* Блок с созданными аккаунтами за сессию */}
      {createdAccounts.length > 0 && (
        <div className={styles.credentialsBlock}>
          <div className={styles.credentialsHeader}>
            <h2 className={styles.credentialsTitle}>
              Созданные аккаунты ({createdAccounts.length})
            </h2>
            <button
              onClick={() => downloadCredentials(createdAccounts)}
              className={styles.downloadBtn}
            >
              Скачать файл с доступами
            </button>
          </div>
          <div className={styles.credentialsList}>
            {createdAccounts.map((acc, i) => (
              <div key={i} className={styles.credentialCard}>
                <div className={styles.credentialName}>
                  {acc.email}
                  <span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>
                    {acc.role === "STUDENT" ? "Студент" : "НР"}
                  </span>
                </div>
                <div className={styles.credentialInfo}>
                  Пароль: <strong>{acc.password}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Таблица приглашений */}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>E-mail</th>
            <th>Статус</th>
            <th>Дата</th>
          </tr>
        </thead>
        <tbody>
          {invitations.length === 0 && (
            <tr>
              <td colSpan={3} className={styles.empty}>
                Аккаунтов пока нет
              </td>
            </tr>
          )}
          {invitations.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.email}</td>
              <td>
                <span className={`${styles.status} ${styles[`status_${inv.status}`]}`}>
                  {STATUS_LABELS[inv.status]}
                </span>
              </td>
              <td>{new Date(inv.createdAt).toLocaleDateString("ru-RU")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
