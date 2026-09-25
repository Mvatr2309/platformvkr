"use client";

import { useEffect, useState } from "react";
import styles from "../expert-form.module.css";

// FR-08: приглашение внешних экспертов (08.06).
// Аккаунт создаёт существующий /api/admin/invitations — он же генерирует
// пароль и отправляет письмо. Здесь только кнопка и список уже приглашённых.
// A2: если почта принадлежит научному руководителю, второй аккаунт не нужен —
// форма предлагает открыть ему роль эксперта на той же почте.

type Invited = {
  id: string;
  email: string;
  name: string;
  role: string;
  cardCompleted: boolean;
  hiddenByOwner: boolean;
};

type Existing = { role: string; name: string | null; isExpert: boolean };

/** Что сказать админу про уже зарегистрированную почту, если роль выдать нельзя */
function existingMessage(ex: Existing): string {
  if (ex.role === "STUDENT") return "Это студент платформы — роль эксперта студентам не выдаётся";
  if (ex.role === "EXPERT") return "Это уже внешний эксперт";
  if (ex.role === "SUPERVISOR" && ex.isExpert) return "У этого научного руководителя роль эксперта уже есть";
  return "Этот пользователь уже зарегистрирован, роль эксперта ему не выдаётся";
}

export default function ExpertInviteForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string; emailError?: string } | null>(null);
  // Почта научного руководителя: ждём подтверждения, что открываем ему роль эксперта
  const [supervisor, setSupervisor] = useState<{ email: string; name: string | null } | null>(null);
  const [granted, setGranted] = useState<{ name: string | null; cardCompleted: boolean } | null>(null);
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
    setSupervisor(null);
    setGranted(null);
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
        const ex: Existing | undefined = data.existing;
        if (res.status === 409 && ex?.role === "SUPERVISOR" && !ex.isExpert) {
          setSupervisor({ email: email.trim(), name: ex.name });
        } else if (res.status === 409 && ex) {
          setError(existingMessage(ex));
        } else {
          setError(data.error || "Не удалось создать аккаунт");
        }
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

  async function grantRole() {
    if (!supervisor) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/expert/admin/grant-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: supervisor.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось открыть роль эксперта");
        return;
      }
      setGranted({ name: data.name, cardCompleted: data.cardCompleted });
      setSupervisor(null);
      setEmail("");
      load();
    } catch {
      setError("Не удалось открыть роль эксперта");
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

          {supervisor && (
            <div className={styles.banner} role="status">
              <strong>{supervisor.name || supervisor.email}</strong> — научный руководитель на
              платформе. Второй аккаунт не нужен: откройте ему роль эксперта на этой же почте.
              Карточку заполним из его профиля, на почту уйдёт письмо «Вам открыт раздел».
              <div className={styles.actions}>
                <button type="button" disabled={busy} className={styles.submitButton} onClick={grantRole}>
                  {busy ? "Открываем…" : "Открыть роль эксперта"}
                </button>
                <button type="button" disabled={busy} className={styles.linkButton} onClick={() => setSupervisor(null)}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {granted && (
            <div className={styles.success}>
              Роль эксперта открыта{granted.name ? `: ${granted.name}` : ""}. Письмо отправлено.{" "}
              {granted.cardCompleted
                ? "Карточка из профиля научного руководителя уже в каталоге."
                : "Карточка появится в каталоге, когда будет заполнен обязательный минимум."}
            </div>
          )}

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
              <span style={{ flex: 1 }}>
                {e.name || e.email}
                {e.role === "SUPERVISOR" && <span className={styles.fieldHint}> · научный руководитель</span>}
              </span>
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
