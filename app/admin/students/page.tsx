"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../invitations/invitations.module.css";

interface Student {
  id: string;
  name: string;
  email: string;
  createdAt: string;
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

      <table className={styles.table}>
        <thead>
          <tr>
            <th>ФИО</th>
            <th>E-mail</th>
            <th>Роль в проекте</th>
            <th>Дата создания</th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.empty}>
                Студентов пока нет
              </td>
            </tr>
          )}
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.email}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
