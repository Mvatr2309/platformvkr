"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../profile.module.css";

const DIRECTIONS = [
  "Управление IT продуктом",
  "Разработка IT-продуктов",
  "Науки о данных",
];

interface StudentData {
  direction: string;
  course: number;
  competencies: string[];
  portfolioUrl: string | null;
  contact: string;
}

const EMPTY: StudentData = {
  direction: "",
  course: 1,
  competencies: [],
  portfolioUrl: null,
  contact: "",
};

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentData>(EMPTY);
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
    if (!profile.direction || !profile.contact) {
      setError("Заполните обязательные поля");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/profile/student", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) setMessage("Профиль сохранён");
      else {
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
