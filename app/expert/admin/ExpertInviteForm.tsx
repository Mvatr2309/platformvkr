"use client";

import { useEffect, useState } from "react";
import styles from "../expert-form.module.css";

// FR-08: приглашение внешних экспертов (08.06).
// Аккаунт создаёт существующий /api/admin/invitations — он же генерирует
// пароль и отправляет письмо. Здесь только кнопка и список уже приглашённых.

type Invited = {
  id: string;
  email: string;
  name: string;
  cardCompleted: boolean;
  hiddenByOwner: boolean;
};

export default function ExpertInviteForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string; emailError?: string } | null>(null);
  const [list, setList] = useState<Invited[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/expert/admin/experts");
      if (res.ok) setList(await res.json());
    } catch {
      /* список не критичен */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreated(null);
    if (!email.trim()) {
      setError("Укажите e-mail");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: "EXPERT" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось создать аккаунт");
        return;
      }
      setCreated({
        email: email.trim(),
        password: data.generatedPassword,
        emailError: data.emailError,
      });
      setEmail("");
      load();
    } catch {
      setError("Не удалось создать аккаунт");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Внешние эксперты</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Пригласить эксперта</h2>
        <form onSubmit={handleInvite}>
          <div className={styles.field}>
            <label className={styles.label}>E-mail *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="expert@company.com"
            />
            <span className={styles.fieldHint}>
              Аккаунт создастся сразу, пароль уйдёт на эту почту. У внешнего эксперта нет
              доступа к «Платформе ВКР» — только экспертная труба. Корпоративная почта
              подойдёт любая, ограничение домена действует только для студентов
            </span>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {created && (
            <div className={styles.success}>
              Аккаунт создан: <strong>{created.email}</strong>
              <br />
              Пароль: <strong>{created.password}</strong>
              {created.emailError && (
                <>
                  <br />
                  Письмо отправить не удалось ({created.emailError}) — передайте пароль вручную.
                </>
              )}
            </div>
          )}

          <div className={styles.actions}>
            <button type="submit" disabled={busy} className={styles.submitButton}>
              {busy ? "Создаём…" : "Создать аккаунт и отправить доступ"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Эксперты в разделе</h2>
        {loading ? (
          <p className={styles.fieldHint}>Загружаем…</p>
        ) : list.length === 0 ? (
          <p className={styles.fieldHint}>Пока никого. Карточки появятся здесь после заполнения.</p>
        ) : (
          list.map((e) => (
            <div
              key={e.id}
              style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--color-border)", fontSize: 14 }}
            >
              <span style={{ flex: 1 }}>{e.name || e.email}</span>
              <span className={styles.fieldHint} style={{ margin: 0 }}>
                {!e.cardCompleted
                  ? "карточка не заполнена"
                  : e.hiddenByOwner
                    ? "скрыта самим экспертом"
                    : "в каталоге"}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
