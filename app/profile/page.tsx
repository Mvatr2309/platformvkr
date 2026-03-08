"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./profile.module.css";

// Опции мультиселектов из спецификации (01-FR-01, раздел 2)
const WORK_PREFERENCES = [
  "Студенты с темой классической диссертации",
  "Студенты без темы (готов предложить тему)",
  "Студенты со своим (корп)стартапом",
  "Студенты, ищущие идею стартапа (готов предложить идею)",
  "Студенты для корпоративного стартапа (готов предложить проект)",
];

const DIRECTIONS = [
  "Управление IT продуктом",
  "Разработка IT-продуктов",
  "Науки о данных",
];

const ACADEMIC_TITLES = ["Нет", "Доцент", "Профессор"];

interface ProfileData {
  workplace: string;
  position: string;
  academicTitle: string;
  academicDegree: string;
  resumeUrl: string | null;
  photoUrl: string | null;
  expertise: string[];
  workPreferences: string[];
  proposedTopics: string | null;
  directions: string[];
  maxSlots: number;
  contact: string;
  status?: string;
}

const EMPTY_PROFILE: ProfileData = {
  workplace: "",
  position: "",
  academicTitle: "",
  academicDegree: "",
  resumeUrl: null,
  photoUrl: null,
  expertise: [],
  workPreferences: [],
  proposedTopics: null,
  directions: [],
  maxSlots: 3,
  contact: "",
};

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [name, setName] = useState("");
  const [agreement, setAgreement] = useState(false);
  const [expertiseInput, setExpertiseInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/profile/supervisor");
    if (res.ok) {
      const data = await res.json();
      if (data) {
        setProfile(data);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (session?.user?.name && !name) {
      setName(session.user.name);
    }
  }, [session, name]);

  function updateField<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArrayItem(key: "workPreferences" | "directions", item: string) {
    setProfile((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item],
      };
    });
  }

  function addExpertise() {
    const tag = expertiseInput.trim();
    if (tag && !profile.expertise.includes(tag)) {
      updateField("expertise", [...profile.expertise, tag]);
    }
    setExpertiseInput("");
  }

  function removeExpertise(tag: string) {
    updateField("expertise", profile.expertise.filter((t) => t !== tag));
  }

  async function uploadFile(file: File, type: "photo" | "resume") {
    const setter = type === "photo" ? setPhotoUploading : setResumeUploading;
    setter(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        updateField(type === "photo" ? "photoUrl" : "resumeUrl", data.url);
      } else {
        setError(data.error || "Ошибка загрузки");
      }
    } catch {
      setError("Ошибка загрузки файла");
    } finally {
      setter(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/profile/supervisor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, name, agreementAccepted: agreement, submit: false }),
      });
      if (res.ok) {
        await updateSession();
        setMessage("Черновик сохранён");
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка сохранения");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!agreement) {
      setError("Необходимо принять соглашение на обработку данных");
      return;
    }
    // Валидация обязательных полей
    if (!profile.workplace || !profile.position || !profile.academicTitle ||
        !profile.academicDegree || !profile.contact || profile.expertise.length === 0 ||
        profile.workPreferences.length === 0 || profile.directions.length === 0) {
      setError("Заполните все обязательные поля");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/profile/supervisor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, name, agreementAccepted: agreement, submit: true }),
      });
      if (res.ok) {
        const result = await res.json();
        await updateSession();
        if (result.status === "APPROVED") {
          setMessage("Профиль сохранён и активирован. Вы видны студентам!");
        } else {
          setMessage("Профиль отправлен на модерацию");
        }
        loadProfile();
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка отправки");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) {
    return <div className={styles.wrapper}><p>Загрузка...</p></div>;
  }

  const isPending = profile.status === "PENDING";

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Профиль научного руководителя</h1>
        {isPending && (
          <div className={styles.notice}>Профиль на модерации. Редактирование ограничено.</div>
        )}

        {/* Секция 1: Основная информация */}
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
              disabled={isPending}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Место работы *</label>
              <input
                type="text"
                value={profile.workplace}
                onChange={(e) => updateField("workplace", e.target.value)}
                className={styles.input}
                placeholder="МФТИ, Сколтех, ВШЭ..."
                disabled={isPending}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Должность *</label>
              <input
                type="text"
                value={profile.position}
                onChange={(e) => updateField("position", e.target.value)}
                className={styles.input}
                placeholder="Профессор кафедры..."
                disabled={isPending}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Учёное звание *</label>
              <select
                value={profile.academicTitle}
                onChange={(e) => updateField("academicTitle", e.target.value)}
                className={styles.select}
                disabled={isPending}
              >
                <option value="">Выберите...</option>
                {ACADEMIC_TITLES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Учёная степень *</label>
              <input
                type="text"
                value={profile.academicDegree}
                onChange={(e) => updateField("academicDegree", e.target.value)}
                className={styles.input}
                placeholder="к.т.н., д.ф.-м.н...."
                disabled={isPending}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Контакт для связи *</label>
            <input
              type="text"
              value={profile.contact}
              onChange={(e) => updateField("contact", e.target.value)}
              className={styles.input}
              placeholder="E-mail, Telegram или телефон"
              disabled={isPending}
            />
          </div>
        </section>

        {/* Секция 2: Экспертиза и направления */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Экспертиза и направления</h2>

          <div className={styles.field}>
            <label className={styles.label}>Доменная экспертиза * <span className={styles.hint}>Введите теги через Enter</span></label>
            <div className={styles.tagsInput}>
              {profile.expertise.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                  {!isPending && (
                    <button type="button" onClick={() => removeExpertise(tag)} className={styles.tagRemove}>×</button>
                  )}
                </span>
              ))}
              {!isPending && (
                <input
                  type="text"
                  value={expertiseInput}
                  onChange={(e) => setExpertiseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExpertise(); } }}
                  className={styles.tagInput}
                  placeholder={profile.expertise.length === 0 ? "ML, NLP, Computer Vision..." : ""}
                />
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Готов работать с *</label>
            <div className={styles.checkboxGroup}>
              {WORK_PREFERENCES.map((pref) => (
                <label key={pref} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={profile.workPreferences.includes(pref)}
                    onChange={() => toggleArrayItem("workPreferences", pref)}
                    disabled={isPending}
                  />
                  <span>{pref}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Направления студентов *</label>
            <div className={styles.checkboxGroup}>
              {DIRECTIONS.map((dir) => (
                <label key={dir} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={profile.directions.includes(dir)}
                    onChange={() => toggleArrayItem("directions", dir)}
                    disabled={isPending}
                  />
                  <span>{dir}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Предлагаемые темы и идеи</label>
            <textarea
              value={profile.proposedTopics || ""}
              onChange={(e) => updateField("proposedTopics", e.target.value)}
              className={styles.textarea}
              rows={4}
              placeholder="Опишите темы, которые готовы предложить студентам..."
              disabled={isPending}
            />
          </div>

          <div className={styles.field} style={{ maxWidth: 200 }}>
            <label className={styles.label}>Макс. проектов одновременно</label>
            <input
              type="number"
              value={profile.maxSlots}
              onChange={(e) => updateField("maxSlots", parseInt(e.target.value) || 1)}
              className={styles.input}
              min={1}
              max={10}
              disabled={isPending}
            />
          </div>
        </section>

        {/* Секция 3: Файлы */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Файлы</h2>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Фото</label>
              {profile.photoUrl && (
                <div className={styles.filePreview}>
                  <img src={profile.photoUrl} alt="Фото" className={styles.photoPreview} />
                </div>
              )}
              {!isPending && (
                <label className={styles.fileButton}>
                  {photoUploading ? "Загрузка..." : "Загрузить фото"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "photo")}
                    hidden
                    disabled={photoUploading}
                  />
                </label>
              )}
              <span className={styles.hint}>JPG, PNG, до 5 МБ</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Резюме</label>
              {profile.resumeUrl && (
                <div className={styles.filePreview}>
                  <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                    Просмотреть файл
                  </a>
                </div>
              )}
              {!isPending && (
                <label className={styles.fileButton}>
                  {resumeUploading ? "Загрузка..." : "Загрузить резюме"}
                  <input
                    type="file"
                    accept=".pdf,.docx,image/jpeg,image/png"
                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "resume")}
                    hidden
                    disabled={resumeUploading}
                  />
                </label>
              )}
              <span className={styles.hint}>PDF, DOCX, до 5 МБ</span>
            </div>
          </div>
        </section>

        {/* Соглашение (01.06) */}
        <section className={styles.section}>
          <label className={styles.agreementLabel}>
            <input
              type="checkbox"
              checked={agreement}
              onChange={(e) => setAgreement(e.target.checked)}
              disabled={isPending}
            />
            <span>
              Я даю согласие на обработку персональных данных в соответствии с политикой конфиденциальности *
            </span>
          </label>
        </section>

        {/* Сообщения */}
        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}

        {/* Кнопки */}
        {!isPending && (
          <div className={styles.actions}>
            <button onClick={handleSave} className={styles.saveButton} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить черновик"}
            </button>
            <button onClick={handleSubmit} className={styles.submitButton} disabled={submitting}>
              {submitting ? "Отправка..." : "Отправить на модерацию"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
