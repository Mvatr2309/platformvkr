"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useDictionaries } from "@/lib/useDictionary";
import styles from "../profile.module.css";

interface StudentData {
  direction: string;
  course: number;
  about: string | null;
  competencies: string[];
  desiredRoles: string[];
  portfolioUrl: string | null;
  contact: string;
}

const EMPTY: StudentData = {
  direction: "",
  course: 1,
  about: null,
  competencies: [],
  desiredRoles: [],
  portfolioUrl: null,
  contact: "",
};

export default function StudentProfilePage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const dicts = useDictionaries("directions", "roles");
  const DIRECTIONS = dicts.directions || [];
  const ROLES = dicts.roles || [];
  const [profile, setProfile] = useState<StudentData>(EMPTY);
  const [name, setName] = useState("");
  const [compInput, setCompInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  function inputCls(field: string) {
    return `${styles.input} ${fieldErrors[field] ? styles.inputError : ""}`;
  }
  function selectCls(field: string) {
    return `${styles.select} ${fieldErrors[field] ? styles.inputError : ""}`;
  }

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/profile/student");
    if (res.ok) {
      const data = await res.json();
      if (data) {
        setProfile(data);
        if (data.name) setName(data.name);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (session?.user?.name && !name) {
      setName(session.user.name);
    }
  }, [session, name]);

  function addCompetency() {
    const tag = compInput.trim();
    if (tag && !profile.competencies.includes(tag)) {
      setProfile((p) => ({ ...p, competencies: [...p.competencies, tag] }));
    }
    setCompInput("");
  }

  function removeCompetency(tag: string) {
    setProfile((p) => ({ ...p, competencies: p.competencies.filter((t) => t !== tag) }));
  }

  async function handleSave() {
    // Если в инпуте компетенций есть незакоммиченный текст — добавляем в массив
    let competencies = profile.competencies;
    const pendingTag = compInput.trim();
    if (pendingTag && !competencies.includes(pendingTag)) {
      competencies = [...competencies, pendingTag];
      setProfile((p) => ({ ...p, competencies }));
      setCompInput("");
    }

    const errs: Record<string, boolean> = {};
    if (!name.trim()) errs.name = true;
    if (!profile.direction) errs.direction = true;
    if (!profile.contact.trim()) errs.contact = true;

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError("Заполните выделенные поля");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/profile/student", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, competencies, name }),
      });
      if (res.ok) {
        await updateSession();
        // Если профиль заполняется впервые — перенаправляем на платформу
        if (!session?.user?.profileCompleted) {
          window.location.href = "/my-projects";
          return;
        }
        setMessage("Профиль сохранён");
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка");
      }
    } catch { setError("Ошибка сети"); }
    finally { setSaving(false); }
  }

  if (!loaded) return <div className={styles.wrapper}><p>Загрузка...</p></div>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Профиль студента</h1>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Основная информация</h2>

          <div className={styles.field}>
            <label className={styles.label}>ФИО *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (e.target.value) setFieldErrors((p) => ({ ...p, name: false })); }}
              className={inputCls("name")}
              placeholder="Иванов Иван Иванович"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>E-mail</label>
            <input
              type="email"
              value={session?.user?.email || ""}
              className={styles.input}
              disabled
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Магистратура *</label>
              <select
                value={profile.direction}
                onChange={(e) => { setProfile((p) => ({ ...p, direction: e.target.value })); if (e.target.value) setFieldErrors((p) => ({ ...p, direction: false })); }}
                className={selectCls("direction")}
              >
                <option value="">Выберите...</option>
                {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Курс *</label>
              <select
                value={profile.course}
                onChange={(e) => setProfile((p) => ({ ...p, course: parseInt(e.target.value) || 1 }))}
                className={styles.select}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Контакт для связи *</label>
            <input
              type="text"
              value={profile.contact}
              onChange={(e) => { setProfile((p) => ({ ...p, contact: e.target.value })); if (e.target.value) setFieldErrors((p) => ({ ...p, contact: false })); }}
              className={inputCls("contact")}
              placeholder="E-mail, Telegram или телефон"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Портфолио</label>
            <input
              type="url"
              value={profile.portfolioUrl || ""}
              onChange={(e) => setProfile((p) => ({ ...p, portfolioUrl: e.target.value || null }))}
              className={styles.input}
              placeholder="https://github.com/username"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>О себе</label>
            <textarea
              value={profile.about || ""}
              onChange={(e) => setProfile((p) => ({ ...p, about: e.target.value || null }))}
              className={styles.textarea}
              rows={4}
              placeholder="Расскажите о своём опыте, экспертизе, интересах и навыках..."
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Компетенции</h2>
          <div className={styles.field}>
            <label className={styles.label}>Ваши навыки <span className={styles.hint}>Введите через Enter</span></label>
            <div className={styles.tagsInput}>
              {profile.competencies.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                  <button type="button" onClick={() => removeCompetency(tag)} className={styles.tagRemove}>×</button>
                </span>
              ))}
              <input
                type="text"
                value={compInput}
                onChange={(e) => setCompInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompetency(); } }}
                className={styles.tagInput}
                placeholder={profile.competencies.length === 0 ? "Python, React, SQL..." : ""}
              />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Желаемые роли в проекте</h2>
          <div className={styles.field}>
            <div className={styles.checkboxGroup}>
              {ROLES.map((role) => (
                <label key={role} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={profile.desiredRoles.includes(role)}
                    onChange={() => {
                      setProfile((p) => ({
                        ...p,
                        desiredRoles: p.desiredRoles.includes(role)
                          ? p.desiredRoles.filter((r) => r !== role)
                          : [...p.desiredRoles, role],
                      }));
                    }}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}

        <div className={styles.actions}>
          <button onClick={handleSave} className={styles.submitButton} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить профиль"}
          </button>
        </div>
      </div>
    </div>
  );
}
