"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "../profile.module.css";

const DIRECTIONS = [
  "Управление IT продуктом",
  "Разработка IT-продуктов",
  "Науки о данных",
];

const ROLES = [
  "Разработчик",
  "ML-инженер",
  "Data Engineer",
  "Data Scientist",
  "Product-менеджер",
];

interface StudentData {
  direction: string;
  course: number;
  competencies: string[];
  desiredRoles: string[];
  portfolioUrl: string | null;
  contact: string;
}

const EMPTY: StudentData = {
  direction: "",
  course: 1,
  competencies: [],
  desiredRoles: [],
  portfolioUrl: null,
  contact: "",
};

export default function StudentProfilePage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [profile, setProfile] = useState<StudentData>(EMPTY);
  const [name, setName] = useState("");
  const [compInput, setCompInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/profile/student");
    if (res.ok) {
      const data = await res.json();
      if (data) setProfile(data);
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
    if (!name.trim()) {
      setError("Укажите ФИО");
      return;
    }
    if (!profile.direction || !profile.contact) {
      setError("Заполните обязательные поля");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/profile/student", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, name }),
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
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              placeholder="Иванов Иван Иванович"
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Направление *</label>
              <select
                value={profile.direction}
                onChange={(e) => setProfile((p) => ({ ...p, direction: e.target.value }))}
                className={styles.select}
              >
                <option value="">Выберите...</option>
                {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Курс *</label>
              <input
                type="number"
                value={profile.course}
                onChange={(e) => setProfile((p) => ({ ...p, course: parseInt(e.target.value) || 1 }))}
                className={styles.input}
                min={1} max={6}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Контакт для связи *</label>
            <input
              type="text"
              value={profile.contact}
              onChange={(e) => setProfile((p) => ({ ...p, contact: e.target.value }))}
              className={styles.input}
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
