"use client";

import { useState, useCallback, useMemo } from "react";
import { useTableSort, compareValues, type SortValue } from "@/lib/useTableSort";
import listStyles from "../list.module.css";
import styles from "./accounts.module.css";

type Role = "ADMIN" | "SUPERVISOR" | "STUDENT";

interface Account {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  profileCompleted: boolean;
  createdAt: string;
}

interface Impact {
  notifications: number;
  invitationsSent: number;
  feedbacks: number;
  supervisedProjects: number;
  supervisorApplications: number;
  memberships: number;
  studentApplications: number;
}

interface Preview {
  user: Account;
  impact: Impact;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Администратор",
  SUPERVISOR: "Научный руководитель",
  STUDENT: "Студент",
};

export default function AccountsPage() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [results, setResults] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Модалка удаления
  const [target, setTarget] = useState<Account | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (role) params.set("role", role);
    const res = await fetch(`/api/admin/accounts?${params.toString()}`);
    if (res.ok) {
      setResults(await res.json());
    } else {
      setResults([]);
    }
    setLoading(false);
  }, [query, role]);

  const openDelete = useCallback(async (account: Account) => {
    setTarget(account);
    setPreview(null);
    setConfirmText("");
    setError(null);
    setPreviewLoading(true);
    const res = await fetch(`/api/admin/accounts/${account.id}`);
    if (res.ok) {
      setPreview(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не удалось загрузить данные аккаунта");
    }
    setPreviewLoading(false);
  }, []);

  const closeModal = useCallback(() => {
    if (deleting) return;
    setTarget(null);
    setPreview(null);
    setConfirmText("");
    setError(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!target) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${target.id}`, { method: "DELETE" });
    if (res.ok) {
      setResults((prev) => prev.filter((a) => a.id !== target.id));
      setTarget(null);
      setPreview(null);
      setConfirmText("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не удалось удалить аккаунт");
    }
    setDeleting(false);
  }, [target]);

  const isAdminTarget = target?.role === "ADMIN";
  const canConfirm =
    !!target && !isAdminTarget && confirmText.trim().toLowerCase() === target.email.toLowerCase();

  const { sortField, sortAsc, toggleSort, arrow } = useTableSort<
    "name" | "email" | "role" | "profile" | "createdAt"
  >();

  const sorted = useMemo(() => {
    if (!sortField) return results;
    const sortVal = (a: Account): SortValue => {
      switch (sortField) {
        case "email": return a.email;
        case "role": return ROLE_LABELS[a.role];
        case "profile": return a.profileCompleted ? 0 : 1;
        case "createdAt": return new Date(a.createdAt).getTime();
        default: return a.name;
      }
    };
    return [...results].sort((a, b) => {
      const cmp = compareValues(sortVal(a), sortVal(b), sortAsc);
      if (cmp !== 0) return cmp;
      return (a.name || "").localeCompare(b.name || "", "ru");
    });
  }, [results, sortField, sortAsc]);

  return (
    <div>
      <h1 className={listStyles.title}>Удаление аккаунтов</h1>

      <div className={styles.notice}>
        Поиск по email или ФИО. Удаление необратимо: профиль и связанные данные
        удаляются безвозвратно. Проекты, созданные научным руководителем,
        сохраняются — они остаются у студентов-участников и помечаются как «без
        руководителя».
      </div>

      <div className={listStyles.controls}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Поиск по email или ФИО..."
          className={listStyles.searchInput}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={listStyles.filterSelect}
        >
          <option value="">Все роли</option>
          <option value="SUPERVISOR">Научные руководители</option>
          <option value="STUDENT">Студенты</option>
          <option value="ADMIN">Администраторы</option>
        </select>
        <button type="button" onClick={search} className={styles.searchBtn}>
          Найти
        </button>
        {searched && <span className={listStyles.count}>Найдено: {results.length}</span>}
      </div>

      <div className={listStyles.tableWrap}>
        <table className={listStyles.table}>
          <thead>
            <tr>
              <th onClick={() => toggleSort("name")}>ФИО{arrow("name")}</th>
              <th onClick={() => toggleSort("email")}>Email{arrow("email")}</th>
              <th onClick={() => toggleSort("role")}>Роль{arrow("role")}</th>
              <th onClick={() => toggleSort("profile")}>Профиль{arrow("profile")}</th>
              <th onClick={() => toggleSort("createdAt")}>Регистрация{arrow("createdAt")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className={listStyles.empty}>Загрузка...</td></tr>
            )}
            {!loading && searched && results.length === 0 && (
              <tr><td colSpan={6} className={listStyles.empty}>Аккаунты не найдены</td></tr>
            )}
            {!loading && !searched && (
              <tr><td colSpan={6} className={listStyles.empty}>Введите запрос и нажмите «Найти»</td></tr>
            )}
            {!loading && sorted.map((a) => (
              <tr key={a.id}>
                <td>{a.name || <span className={listStyles.muted}>Не указано</span>}</td>
                <td>{a.email}</td>
                <td>{ROLE_LABELS[a.role]}</td>
                <td>
                  {a.profileCompleted ? (
                    <span className={listStyles.statusBadge + " " + listStyles.status_OPEN}>Заполнен</span>
                  ) : (
                    <span className={listStyles.statusBadge + " " + listStyles.status_PENDING}>Не заполнен</span>
                  )}
                </td>
                <td>{new Date(a.createdAt).toLocaleDateString("ru-RU")}</td>
                <td>
                  {a.role === "ADMIN" ? (
                    <span className={listStyles.muted}>—</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => openDelete(a)}
                    >
                      Удалить
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Удаление аккаунта</h2>

            <div className={styles.targetInfo}>
              <div><strong>{target.name || "Без имени"}</strong></div>
              <div className={styles.targetEmail}>{target.email}</div>
              <div className={styles.targetRole}>{ROLE_LABELS[target.role]}</div>
            </div>

            {isAdminTarget && (
              <div className={styles.errorBox}>
                Удаление администраторов через этот раздел запрещено.
              </div>
            )}

            {previewLoading && <p className={listStyles.muted}>Загрузка данных...</p>}

            {preview && !isAdminTarget && (
              <>
                <div className={styles.impactTitle}>Будет затронуто:</div>
                <ul className={styles.impactList}>
                  {target.role === "SUPERVISOR" && (
                    <>
                      <li>
                        Проекты под руководством: <strong>{preview.impact.supervisedProjects}</strong>
                        {preview.impact.supervisedProjects > 0 && (
                          <span className={styles.impactNote}> — сохранятся как «без руководителя»</span>
                        )}
                      </li>
                      <li>Заявки на руководство: <strong>{preview.impact.supervisorApplications}</strong> <span className={styles.impactNote}>— будут отвязаны</span></li>
                    </>
                  )}
                  {target.role === "STUDENT" && (
                    <>
                      <li>Участие в проектах: <strong>{preview.impact.memberships}</strong> <span className={styles.impactNote}>— будет удалено</span></li>
                      <li>Поданные заявки: <strong>{preview.impact.studentApplications}</strong> <span className={styles.impactNote}>— будут удалены</span></li>
                    </>
                  )}
                  <li>Уведомления: <strong>{preview.impact.notifications}</strong></li>
                  <li>Обращения в обратную связь: <strong>{preview.impact.feedbacks}</strong></li>
                  {preview.impact.invitationsSent > 0 && (
                    <li>Отправленные приглашения: <strong>{preview.impact.invitationsSent}</strong></li>
                  )}
                </ul>

                <label className={styles.confirmLabel}>
                  Для подтверждения введите email аккаунта:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={target.email}
                  className={styles.confirmInput}
                  autoComplete="off"
                />
              </>
            )}

            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={closeModal}
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmDeleteBtn}
                onClick={confirmDelete}
                disabled={!canConfirm || deleting}
              >
                {deleting ? "Удаление..." : "Удалить безвозвратно"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
