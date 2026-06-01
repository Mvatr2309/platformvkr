"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDictionary } from "@/lib/useDictionary";
import Pagination, { usePagination } from "@/components/Pagination";
import styles from "./invitations.module.css";

interface Invitation {
  id: string;
  name: string;
  email: string;
  status: "SENT" | "ACCEPTED" | "EXPIRED";
  role: "STUDENT" | "SUPERVISOR" | null;
  createdAt: string;
  sentBy: { name: string };
}

interface CreatedAccount {
  email: string;
  password: string;
  role: string;
  cohort?: string;
}

const STATUS_LABELS: Record<string, string> = {
  SENT: "Отправлено",
  ACCEPTED: "Создан",
  EXPIRED: "Истекло",
};

function downloadCredentials(accounts: CreatedAccount[]) {
  const lines = accounts.map(
    (a) => `${a.role === "STUDENT" ? "Студент" : "Научный руководитель"}\nЛогин: ${a.email}\nПароль: ${a.password}\n`
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

interface SkipResult {
  email: string;
  status: "skipped" | "invalid" | "created_mail_error";
  reason?: string;
  error?: string;
}

export default function InvitationsPage() {
  const COHORTS = useDictionary("cohorts");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [emailsText, setEmailsText] = useState("");
  const [role, setRole] = useState<"SUPERVISOR" | "STUDENT">("SUPERVISOR");
  const [cohort, setCohort] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdAccounts, setCreatedAccounts] = useState<CreatedAccount[]>([]);
  const [skipResults, setSkipResults] = useState<SkipResult[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<"ALL" | "STUDENT" | "SUPERVISOR">("ALL");

  // Парсим e-mail из textarea: запятая, точка с запятой, перенос строки, табуляция, пробел
  const parsedEmails = useMemo(() => {
    const set = new Set<string>();
    const list: string[] = [];
    for (const raw of emailsText.split(/[\s,;]+/)) {
      const t = raw.trim();
      if (!t) continue;
      const lower = t.toLowerCase();
      if (set.has(lower)) continue;
      set.add(lower);
      list.push(t);
    }
    return list;
  }, [emailsText]);

  const filteredInvitations = useMemo(() =>
    invitations.filter((inv) => roleFilter === "ALL" || inv.role === roleFilter),
    [invitations, roleFilter]
  );

  const { page, setPage, totalPages, paged } = usePagination(filteredInvitations, 20);

  useEffect(() => { setPage(1); }, [roleFilter, setPage]);

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
    setSkipResults([]);

    if (parsedEmails.length === 0) {
      setError("Вставьте хотя бы один e-mail");
      return;
    }
    if (role === "STUDENT" && !cohort) {
      setError("Выберите когорту");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/invitations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: parsedEmails,
          role,
          cohort: role === "STUDENT" ? cohort : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка создания");
        return;
      }

      const created: CreatedAccount[] = [];
      const skips: SkipResult[] = [];
      type RawResult = { email: string; status: string; password?: string; reason?: string; error?: string };
      for (const r of (data.results as RawResult[])) {
        if ((r.status === "created" || r.status === "created_mail_error") && r.password) {
          created.push({ email: r.email, password: r.password, role, cohort: role === "STUDENT" ? cohort : undefined });
          if (r.status === "created_mail_error") {
            skips.push({ email: r.email, status: "created_mail_error", error: r.error });
          }
        } else if (r.status === "skipped" || r.status === "invalid") {
          skips.push({ email: r.email, status: r.status, reason: r.reason });
        }
      }

      setCreatedAccounts((prev) => [...prev, ...created]);
      setSkipResults(skips);
      setSuccess(
        `Готово. Создано: ${data.summary.created}, пропущено: ${data.summary.skipped}, невалидных: ${data.summary.invalid}` +
        (data.summary.mailErrors > 0 ? `, письмо не ушло: ${data.summary.mailErrors}` : "")
      );
      setEmailsText("");
      fetchInvitations();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Удалить аккаунт ${email}? Это действие необратимо.`)) return;
    setDeleting(id);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: id }),
      });
      if (res.ok) {
        setSuccess(`Аккаунт ${email} удалён`);
        fetchInvitations();
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка удаления");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <h1 className={styles.title}>Создание аккаунтов</h1>

      {/* Форма создания аккаунтов (одиночное или массовое) */}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field} style={{ marginBottom: 12 }}>
          <label className={styles.label}>
            E-mail (логин){parsedEmails.length > 1 ? ` — ${parsedEmails.length} адресов` : ""}
          </label>
          <textarea
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            placeholder={"ivanov@mipt.ru\npetrov@mipt.ru, sidorov@mipt.ru\n…"}
            className={styles.input}
            rows={Math.min(8, Math.max(3, parsedEmails.length + 1))}
            style={{ resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }}
          />
          <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Можно вставить список одним блоком — разделители: запятая, точка с запятой, пробел, перенос строки. Дубли и невалидные адреса будут отсеяны автоматически.
          </p>
        </div>
        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.label}>Роль (одна на всю партию)</label>
            <select
              value={role}
              onChange={(e) => { setRole(e.target.value as "SUPERVISOR" | "STUDENT"); if (e.target.value !== "STUDENT") setCohort(""); }}
              className={styles.input}
            >
              <option value="SUPERVISOR">Научный руководитель</option>
              <option value="STUDENT">Студент</option>
            </select>
          </div>
          {role === "STUDENT" && (
            <div className={styles.field}>
              <label className={styles.label}>Когорта</label>
              <select
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                className={styles.input}
                required
              >
                <option value="">Выберите...</option>
                {COHORTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <button type="submit" className={styles.button} disabled={loading || parsedEmails.length === 0}>
            {loading
              ? "Создание..."
              : parsedEmails.length <= 1
                ? "Создать аккаунт"
                : `Создать ${parsedEmails.length} аккаунтов`}
          </button>
        </div>
      </form>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      {skipResults.length > 0 && (
        <div style={{ background: "#FFF8E1", border: "1px solid #f0d97a", padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Не созданы / с замечаниями ({skipResults.length}):</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#555" }}>
            {skipResults.map((r, i) => (
              <li key={i}>
                <strong>{r.email}</strong> — {r.status === "invalid" ? `невалидный e-mail${r.reason ? ` (${r.reason})` : ""}` : r.status === "created_mail_error" ? `аккаунт создан, но письмо не ушло (${r.error || "ошибка SMTP"}) — пароль см. ниже` : (r.reason || "пропущен")}
              </li>
            ))}
          </ul>
        </div>
      )}

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
                    {acc.role === "STUDENT" ? "Студент" : "Научный руководитель"}
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

      {/* Фильтр по роли */}
      <div className={styles.filterRow}>
        <label className={styles.label}>Фильтр по роли:</label>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "ALL" | "STUDENT" | "SUPERVISOR")}
          className={styles.input}
          style={{ width: "auto", minWidth: 200 }}
        >
          <option value="ALL">Все</option>
          <option value="STUDENT">Студенты</option>
          <option value="SUPERVISOR">Научные руководители</option>
        </select>
      </div>

      {/* Таблица приглашений */}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>E-mail</th>
            <th>Роль</th>
            <th>Статус</th>
            <th>Дата</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {paged.length === 0 && (
            <tr>
              <td colSpan={5} className={styles.empty}>
                Аккаунтов пока нет
              </td>
            </tr>
          )}
          {paged.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.email}</td>
              <td>
                <span className={`${styles.roleBadge} ${inv.role === "STUDENT" ? styles.roleBadgeStudent : styles.roleBadgeSupervisor}`}>
                  {inv.role === "STUDENT" ? "Студент" : inv.role === "SUPERVISOR" ? "Науч. рук." : "—"}
                </span>
              </td>
              <td>
                <span className={`${styles.status} ${styles[`status_${inv.status}`]}`}>
                  {STATUS_LABELS[inv.status]}
                </span>
              </td>
              <td>{new Date(inv.createdAt).toLocaleDateString("ru-RU")}</td>
              <td>
                <button
                  onClick={() => handleDelete(inv.id, inv.email)}
                  className={styles.deleteBtn}
                  disabled={deleting === inv.id}
                >
                  {deleting === inv.id ? "..." : "Удалить"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
