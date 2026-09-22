"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useDictionaries } from "@/lib/useDictionary";
import styles from "./expert-form.module.css";

// FR-08: карточка эксперта (08.08, 08.09).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 5.2)
//
// Набор полей повторяет профиль научного руководителя, кроме полей про
// руководство проектом и модерацию. Вместо «Предлагаемых тем» — «С какими
// темами могу помочь», опционально. Контакт виден только студенту
// с принятым запросом, поэтому здесь он просто поле ввода.

const PROJECT_TYPES = [
  { value: "CLASSIC_DISSERTATION", label: "Исследования" },
  { value: "STARTUP", label: "Стартапы" },
  { value: "CORPORATE_STARTUP", label: "Корпоративные стартапы" },
];

type CardData = {
  workplace: string;
  position: string;
  academicTitle: string;
  academicDegree: string;
  resumeUrl: string | null;
  photoUrl: string | null;
  expertise: string[];
  helpTopics: string;
  directions: string[];
  projectTypes: string[];
  contact: string;
  hiddenByOwner: boolean;
};

const EMPTY: CardData = {
  workplace: "",
  position: "",
  academicTitle: "",
  academicDegree: "",
  resumeUrl: null,
  photoUrl: null,
  expertise: [],
  helpTopics: "",
  directions: [],
  projectTypes: [],
  contact: "",
  hiddenByOwner: false,
};

export default function ExpertProfileForm() {
  const { update: updateSession } = useSession();
  const dicts = useDictionaries("directions", "academicTitles");
  const DIRECTIONS = dicts.directions || [];
  const ACADEMIC_TITLES = dicts.academicTitles || [];

  const [card, setCard] = useState<CardData>(EMPTY);
  const [name, setName] = useState("");
  const [cardCompleted, setCardCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expertiseInput, setExpertiseInput] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/expert/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setName(data.name || "");
        if (data.profile) {
          setCard({
            workplace: data.profile.workplace || "",
            position: data.profile.position || "",
            academicTitle: data.profile.academicTitle || "",
            academicDegree: data.profile.academicDegree || "",
            resumeUrl: data.profile.resumeUrl,
            photoUrl: data.profile.photoUrl,
            expertise: data.profile.expertise || [],
            helpTopics: data.profile.helpTopics || "",
            directions: data.profile.directions || [],
            projectTypes: data.profile.projectTypes || [],
            contact: data.profile.contact || "",
            hiddenByOwner: Boolean(data.profile.hiddenByOwner),
          });
          setCardCompleted(Boolean(data.profile.cardCompleted));
        }
      })
      .catch(() => setError("Не удалось загрузить карточку"))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof CardData>(key: K, value: CardData[K]) {
    setCard((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: false }));
  }

  function toggleItem(key: "directions" | "projectTypes", item: string) {
    setCard((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item],
      };
    });
  }

  function addExpertise() {
    const tags = expertiseInput.split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length > 0) {
      const merged = [...card.expertise];
      for (const tag of tags) if (!merged.includes(tag)) merged.push(tag);
      set("expertise", merged);
    }
    setExpertiseInput("");
  }

  async function uploadFile(file: File, type: "photo" | "resume") {
    const setter = type === "photo" ? setPhotoUploading : setResumeUploading;
    setter(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        set(type === "photo" ? "photoUrl" : "resumeUrl", data.url);
      } else {
        setError(data.error || "Не удалось загрузить файл");
      }
    } catch {
      setError("Не удалось загрузить файл");
    } finally {
      setter(false);
    }
  }

  function validate(): boolean {
    const errs: Record<string, boolean> = {};
    if (!card.workplace.trim()) errs.workplace = true;
    if (!card.position.trim()) errs.position = true;
    // Резюме обязательно: это подтверждение опыта
    if (!card.resumeUrl || !card.resumeUrl.trim()) errs.resumeUrl = true;
    if (card.expertise.length === 0) errs.expertise = true;
    if (!card.contact.trim()) errs.contact = true;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Незакоммиченный текст в поле тегов добавляем автоматически
    let expertise = card.expertise;
    if (expertiseInput.trim()) {
      const tags = expertiseInput.split(",").map((t) => t.trim()).filter(Boolean);
      expertise = [...expertise];
      for (const tag of tags) if (!expertise.includes(tag)) expertise.push(tag);
      set("expertise", expertise);
      setExpertiseInput("");
    }

    if (!validate()) {
      setError("Заполните обязательные поля, они отмечены красным");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/expert/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...card, expertise, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить карточку");
        return;
      }
      setCardCompleted(Boolean(data.cardCompleted));
      setSuccess("Карточка сохранена");
      // Признак роли и заполненности профиля перечитываются из БД
      await updateSession();
    } catch {
      setError("Не удалось сохранить карточку");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (f: string) => `${styles.input} ${fieldErrors[f] ? styles.inputError : ""}`;

  if (loading) {
    return <div className={styles.loading}>Загружаем карточку…</div>;
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Карточка эксперта</h1>

      {!cardCompleted && (
        <div className={styles.banner}>
          Карточка ещё не заполнена, поэтому студенты вас не видят. Заполните обязательные
          поля и сохраните — карточка появится в каталоге сразу, без модерации.
        </div>
      )}

      {cardCompleted && card.hiddenByOwner && (
        <div className={styles.banner}>
          Карточка скрыта из каталога по вашему решению. Студенты не могут отправить вам
          запрос, пока вы её не вернёте.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Кто вы</h2>

          <div className={styles.field}>
            <label className={styles.label}>ФИО *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              placeholder="Иванов Иван Иванович"
            />
            <span className={styles.fieldHint}>Одно имя на оба раздела платформы</span>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Место работы *</label>
              <input
                type="text"
                value={card.workplace}
                onChange={(e) => set("workplace", e.target.value)}
                className={inputCls("workplace")}
                placeholder="Компания или организация"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Должность *</label>
              <input
                type="text"
                value={card.position}
                onChange={(e) => set("position", e.target.value)}
                className={inputCls("position")}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Учёное звание</label>
              <select
                value={card.academicTitle}
                onChange={(e) => set("academicTitle", e.target.value)}
                className={styles.select}
              >
                <option value="">Нет</option>
                {ACADEMIC_TITLES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Учёная степень</label>
              <input
                type="text"
                value={card.academicDegree}
                onChange={(e) => set("academicDegree", e.target.value)}
                className={styles.input}
                placeholder="к.т.н., PhD или оставьте пустым"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Фото</label>
            {card.photoUrl && (
              <div className={styles.filePreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.photoUrl} alt="Фото" className={styles.photoPreview} />
                <button type="button" onClick={() => set("photoUrl", null)} className={styles.fileButton}>
                  Удалить
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={photoUploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f, "photo");
              }}
            />
            <span className={styles.fieldHint}>
              {photoUploading ? "Загружаем…" : "Необязательно. JPG, PNG или WebP"}
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Опыт</h2>

          <div className={styles.field}>
            <label className={styles.label}>Резюме *</label>
            {card.resumeUrl && (
              <div className={styles.filePreview}>
                <a href={card.resumeUrl} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                  {card.resumeUrl.startsWith("http") ? "Открыть ссылку" : "Просмотреть файл"}
                </a>
                <button type="button" onClick={() => set("resumeUrl", null)} className={styles.fileButton}>
                  Удалить
                </button>
              </div>
            )}
            <input
              type="url"
              value={card.resumeUrl?.startsWith("http") ? card.resumeUrl : ""}
              onChange={(e) => set("resumeUrl", e.target.value || null)}
              className={inputCls("resumeUrl")}
              placeholder="Ссылка на резюме"
            />
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={resumeUploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f, "resume");
              }}
            />
            <span className={styles.fieldHint}>
              {resumeUploading
                ? "Загружаем…"
                : "Ссылка или файл PDF, DOC, DOCX. Студент видит резюме в каталоге — это подтверждение вашего опыта"}
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Доменная экспертиза *
              <span className={styles.hint}> Введите теги через Enter или запятую</span>
            </label>
            <div className={`${styles.tagsInput} ${fieldErrors.expertise ? styles.inputError : ""}`}>
              {card.expertise.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                  <button
                    type="button"
                    onClick={() => set("expertise", card.expertise.filter((t) => t !== tag))}
                    className={styles.tagRemove}
                    aria-label={`Убрать ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={expertiseInput}
                onChange={(e) => setExpertiseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addExpertise();
                  }
                }}
                onBlur={addExpertise}
                className={styles.tagInput}
                placeholder={card.expertise.length === 0 ? "Например: Машинное обучение" : ""}
              />
            </div>
            <span className={styles.fieldHint}>По этим тегам студенты фильтруют каталог</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>С какими темами могу помочь</label>
            <textarea
              value={card.helpTopics}
              onChange={(e) => set("helpTopics", e.target.value)}
              className={styles.textarea}
              rows={4}
              placeholder="Необязательно. Опишите, с какими вопросами к вам приходить"
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Кого консультируете</h2>

          <div className={styles.field}>
            <label className={styles.label}>Направления студентов</label>
            <div className={styles.checkboxGroup}>
              {DIRECTIONS.map((dir) => (
                <label key={dir} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={card.directions.includes(dir)}
                    onChange={() => toggleItem("directions", dir)}
                  />
                  {dir}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Типы проектов</label>
            <div className={styles.checkboxGroup}>
              {PROJECT_TYPES.map((pt) => (
                <label key={pt.value} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={card.projectTypes.includes(pt.value)}
                    onChange={() => toggleItem("projectTypes", pt.value)}
                  />
                  {pt.label}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Связь и видимость</h2>

          <div className={styles.field}>
            <label className={styles.label}>Контакт *</label>
            <input
              type="text"
              value={card.contact}
              onChange={(e) => set("contact", e.target.value)}
              className={inputCls("contact")}
              placeholder="Telegram, почта или телефон"
            />
            <span className={styles.fieldHint}>
              Контакт увидит только студент, чей запрос вы приняли. В каталоге он скрыт
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={card.hiddenByOwner}
                onChange={(e) => set("hiddenByOwner", e.target.checked)}
              />
              Скрыть карточку из каталога
            </label>
            <span className={styles.fieldHint}>
              Пригодится в отпуске или при перегрузке. Уже принятые запросы это не затрагивает
            </span>
          </div>
        </section>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <div className={styles.actions}>
          <button type="submit" disabled={saving} className={styles.submitButton}>
            {saving ? "Сохраняем…" : "Сохранить карточку"}
          </button>
        </div>
      </form>
    </div>
  );
}
