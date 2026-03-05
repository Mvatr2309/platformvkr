"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./new-project.module.css";

const PROJECT_TYPES = [
  { value: "CLASSIC_DISSERTATION", label: "Классическая диссертация" },
  { value: "STARTUP", label: "Стартап" },
  { value: "CORPORATE_STARTUP", label: "Корпоративный стартап" },
];

const DIRECTIONS = [
  "Управление IT продуктом",
  "Разработка IT-продуктов",
  "Науки о данных",
];

const ROLES = [
  "Разработчик",
  "Дизайнер",
  "Аналитик",
  "Продакт-менеджер",
  "Маркетолог",
  "Тестировщик",
];

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("");
  const [direction, setDirection] = useState("");
  const [requiredRoles, setRequiredRoles] = useState<string[]>([]);
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function toggleRole(role: string) {
    setRequiredRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSave(submit: boolean) {
    if (!title || !description || !projectType || !contact) {
      setError("Заполните обязательные поля");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, projectType, direction, requiredRoles, contact, submit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка");
        return;
      }
      if (submit) {
        setMessage("Проект отправлен на модерацию");
        setTimeout(() => router.push(`/projects/${data.id}`), 1000);
      } else {
        setMessage("Черновик сохранён");
        setTimeout(() => router.push(`/projects/${data.id}`), 1000);
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Новый проект</h1>

        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label}>Название проекта *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
              placeholder="Например: Roomschool — детская онлайн-школа с ИИ"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Тип работы *</label>
            <div className={styles.typeGroup}>
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`${styles.typeOption} ${projectType === t.value ? styles.typeActive : ""}`}
                  onClick={() => setProjectType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {projectType === "CLASSIC_DISSERTATION" && (
            <div className={styles.field}>
              <label className={styles.label}>Направление</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                className={styles.select}
              >
                <option value="">Выберите...</option>
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Описание *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
              rows={6}
              placeholder={
                projectType === "CLASSIC_DISSERTATION"
                  ? "Цели, задачи, ожидаемые результаты..."
                  : "Описание продукта, целевая аудитория, проблема, решение..."
              }
            />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label}>Требуемые роли</label>
            <div className={styles.checkboxGroup}>
              {ROLES.map((role) => (
                <label key={role} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={requiredRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Контакт для связи *</label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className={styles.input}
              placeholder="E-mail, Telegram или телефон"
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}

        <div className={styles.actions}>
          <button
            onClick={() => handleSave(false)}
            className={styles.saveButton}
            disabled={saving}
          >
            Сохранить черновик
          </button>
          <button
            onClick={() => handleSave(true)}
            className={styles.submitButton}
            disabled={saving}
          >
            Отправить на модерацию
          </button>
        </div>
      </div>
    </div>
  );
}
