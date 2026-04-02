"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../invitations/invitations.module.css";

interface Student {
  id: string;
  memberId?: string;
  name: string;
  email: string;
  createdAt: string;
  inSystem: boolean;
  projectRoles: Array<{ role: string; projectTitle: string }>;
}

interface CreatedAccount {
  name: string;
  email: string;
  password: string;
}

function downloadCredentials(accounts: CreatedAccount[]) {
  const lines = accounts.map(
    (a) => `${a.name}\nЛогин: ${a.email}\nПароль: ${a.password}\n`
  );
  const text = "=== Доступы студентов — Платформа ВКР ===\n\n" + lines.join("\n---\n\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vkr-students-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdAccounts, setCreatedAccounts] = useState<CreatedAccount[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "in_system" | "not_in_system">("all");

  const fetchStudents = useCallback(async () => {
    const res = await fetch("/api/admin/students");
    if (res.ok) {
      setStudents(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка создания");
        return;
      }

      const account: CreatedAccount = {
        name,
        email,
        password: data.generatedPassword,
      };

      setCreatedAccounts((prev) => [...prev, account]);
      setSuccess(`Аккаунт создан: ${email} / ${data.generatedPassword}`);
      setName("");
      setEmail("");
      fetchStudents();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(memberId: string) {
    setInvitingId(memberId);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка приглашения");
        return;
      }
      if (data.generatedPassword) {
        const account: CreatedAccount = {
          name: data.name,
          email: data.email,
          password: data.generatedPassword,
        };
        setCreatedAccounts((prev) => [...prev, account]);
        setSuccess(`Аккаунт создан: ${data.email} / ${data.generatedPassword}`);
      } else {
        setSuccess(`Участник ${data.email} привязан к существующему аккаунту`);
      }
      fetchStudents();
    } catch {
      setError("Ошибка сети");
    } finally {
      setInvitingId(null);
    }
  }

  const filtered = students.filter((s) => {
    if (filter === "in_system") return s.inSystem;
    if (filter === "not_in_system") return !s.inSystem;
    return true;
  });

  const inSystemCount = students.filter((s) => s.inSystem).length;
  const notInSystemCount = students.filter((s) => !s.inSystem).length;

  return (
    <div>
      <h1 className={styles.title}>Управление студентами</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.label}>ФИО</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Петров Пётр Петрович"
              className={styles.input}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>E-mail (логин)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="petrov@phystech.edu"
              className={styles.input}
              required
            />
          </div>
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Создание..." : "Создать аккаунт"}
          </button>
        </div>
      </form>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

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
                <div className={styles.credentialName}>{acc.name}</div>
                <div className={styles.credentialInfo}>
                  Логин: <strong>{acc.email}</strong> &nbsp;|&nbsp; Пароль: <strong>{acc.password}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setFilter("all")}
          className={styles.button}
          style={{ background: filter === "all" ? "#003092" : "#e0e0e0", color: filter === "all" ? "#fff" : "#333", padding: "6px 16px" }}
        >
          Все ({students.length})
        </button>
        <button
          onClick={() => setFilter("in_system")}
          className={styles.button}
          style={{ background: filter === "in_system" ? "#003092" : "#e0e0e0", color: filter === "in_system" ? "#fff" : "#333", padding: "6px 16px" }}
        >
          В системе ({inSystemCount})
        </button>
        <button
          onClick={() => setFilter("not_in_system")}
          className={styles.button}
          style={{ background: filter === "not_in_system" ? "#003092" : "#e0e0e0", color: filter === "not_in_system" ? "#fff" : "#333", padding: "6px 16px" }}
        >
          Не в системе ({notInSystemCount})
        </button>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>ФИО</th>
            <th>E-mail</th>
            <th>Статус ЛК</th>
            <th>Роль в проекте</th>
            <th>Дата</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className={styles.empty}>
                Студентов пока нет
              </td>
            </tr>
          )}
          {filtered.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.email}</td>
              <td>
                <span style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: s.inSystem ? "#e8f5e9" : "#fce4ec",
                  color: s.inSystem ? "#2e7d32" : "#c62828",
                }}>
                  {s.inSystem ? "В системе" : "Не в системе"}
                </span>
              </td>
              <td>
                {s.projectRoles.length > 0 ? (
                  s.projectRoles.map((pr, i) => (
                    <div key={i} title={pr.projectTitle} style={{ fontSize: 13 }}>
                      {pr.role} <span style={{ color: "#888" }}>— {pr.projectTitle}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ color: "#999" }}>—</span>
                )}
              </td>
              <td>{new Date(s.createdAt).toLocaleDateString("ru-RU")}</td>
              <td>
                {!s.inSystem && s.memberId && (
                  <button
                    onClick={() => handleInvite(s.memberId!)}
                    className={styles.button}
                    disabled={invitingId === s.memberId}
                    style={{ padding: "4px 12px", fontSize: 13 }}
                  >
                    {invitingId === s.memberId ? "..." : "Пригласить"}
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
