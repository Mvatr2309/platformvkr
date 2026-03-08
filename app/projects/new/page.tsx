"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
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
  "ML-инженер",
  "Data Engineer",
  "Data Scientist",
  "Product-менеджер",
];

export default function NewProjectPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isStudent = session?.user?.role === "STUDENT";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("");
  const [direction, setDirection] = useState("");
  const [requiredRoles, setRequiredRoles] = useState<string[]>([]);
  const [authorRole, setAuthorRole] = useState("");
  const [contact, setContact] = useState("");
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function toggleRole(role: string) {
    setRequiredRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "project");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setFiles((prev) => [...prev, { name: file.name, url: data.url }]);
      } else {
        setError(data.error || "Ошибка загрузки файла");
      }
    } catch {
      setError("Ошибка загрузки файла");
    } finally {
      setUploading(false);
    }
  }

  function removeFile(url: string) {
    setFiles((prev) => prev.filter((f) => f.url !== url));
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
          title, description, projectType, direction, requiredRoles, authorRole, contact, submit, files,
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

          {isStudent && (
            <div className={styles.field}>
              <label className={styles.label}>Моя роль в проекте</label>
              <select
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value)}
                className={styles.select}
              >
                <option value="">Выберите роль...</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

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

        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label}>Файлы (паспорт проекта, презентация и др.)</label>
            {files.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {files.map((f) => (
                  <div key={f.url} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className={styles.label} style={{ color: "#003092" }}>
                      {f.name}
                    </a>
                    <button type="button" onClick={() => removeFile(f.url)} style={{ background: "none", border: "none", color: "#E8375A", cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <label className={styles.saveButton} style={{ display: "inline-block", cursor: "pointer", textAlign: "center" }}>
              {uploading ? "Загрузка..." : "Прикрепить файл"}
              <input
                type="file"
                accept=".pdf,.docx,.pptx,.xlsx,image/jpeg,image/png"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                hidden
                disabled={uploading}
              />
            </label>
            <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>PDF, DOCX, PPTX, до 5 МБ</span>
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
