"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useDictionaries } from "@/lib/useDictionary";
import styles from "./profile.module.css";

const PROJECT_TYPES = [
  { value: "CLASSIC_DISSERTATION", label: "Исследования" },
  { value: "STARTUP", label: "Стартапы" },
  { value: "CORPORATE_STARTUP", label: "Корпоративные стартапы" },
];

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
  projectTypes: string[];
  maxProjects: number;
  contact: string;
  status?: string;
  recruitmentStatus?: string;
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
  projectTypes: [],
  maxProjects: 4,
  contact: "",
  recruitmentStatus: "OPEN",
};

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const dicts = useDictionaries("directions", "academicTitles");
  const DIRECTIONS = dicts.directions || [];
  const ACADEMIC_TITLES = dicts.academicTitles || [];
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [name, setName] = useState("");
  const [agreement, setAgreement] = useState(false);
  const [expertiseInput, setExpertiseInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  function inputCls(field: string) {
    return `${styles.input} ${fieldErrors[field] ? styles.inputError : ""}`;
  }
  function selectCls(field: string) {
    return `${styles.select} ${fieldErrors[field] ? styles.inputError : ""}`;
  }
  function fieldCls(field: string) {
    return fieldErrors[field] ? `${styles.field} ${styles.fieldErrorContainer}` : styles.field;
  }

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/profile/supervisor");
    if (res.ok) {
      const data = await res.json();
      if (data) {
        setProfile(data);
        if (data.name) setName(data.name);
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

  function toggleArrayItem(key: "directions" | "projectTypes", item: string) {
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
    // Если в инпуте экспертизы есть незакоммиченный текст — добавляем в массив
    let expertise = profile.expertise;
    const pendingTag = expertiseInput.trim();
    if (pendingTag && !expertise.includes(pendingTag)) {
      expertise = [...expertise, pendingTag];
      setProfile((p) => ({ ...p, expertise }));
      setExpertiseInput("");
    }

    const errs: Record<string, boolean> = {};
    if (!name.trim()) errs.name = true;
    if (!profile.resumeUrl || !profile.resumeUrl.trim()) errs.resumeUrl = true;
    if (!profile.workplace.trim()) errs.workplace = true;
    if (!profile.position.trim()) errs.position = true;
    if (!profile.academicTitle) errs.academicTitle = true;
    if (!profile.academicDegree.trim()) errs.academicDegree = true;
    if (!profile.contact.trim()) errs.contact = true;
    if (expertise.length === 0) errs.expertise = true;
    if (profile.directions.length === 0) errs.directions = true;
    if (profile.projectTypes.length === 0) errs.projectTypes = true;
    if (!agreement) errs.agreement = true;

    setFieldErrors(errs);

    if (Object.keys(errs).length > 0) {
      setError("Заполните выделенные поля");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/profile/supervisor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, expertise, name, agreementAccepted: agreement }),
      });
      if (res.ok) {
        await updateSession();
        // Если профиль заполняется впервые — перенаправляем на платформу
        if (!session?.user?.profileCompleted) {
          window.location.href = "/my-projects";
          return;
        }
        setMessage("Профиль сохранён");
        loadProfile();
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

  if (!loaded) {
    return <div className={styles.wrapper}><p>Загрузка...</p></div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Профиль научного руководителя</h1>

        {/* Секция 0: Резюме (CV) — обязательно */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Резюме *</h2>
          <p className={styles.fieldHint}>
            Прикрепите файл резюме (PDF, DOCX) или укажите ссылку (LinkedIn, hh.ru, личная страница и т.п.)
          </p>

          {profile.resumeUrl && (
            <div className={styles.filePreview}>
              <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                {profile.resumeUrl.startsWith("http") ? "Открыть ссылку" : "Просмотреть файл"}
              </a>
              <button
                type="button"
                onClick={() => updateField("resumeUrl", null)}
                className={styles.tagRemove}
                style={{ marginLeft: 8 }}
                title="Удалить"
              >
                ×
              </button>
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Ссылка на резюме</label>
              <input
                type="url"
                value={profile.resumeUrl?.startsWith("http") ? profile.resumeUrl : ""}
                onChange={(e) => { updateField("resumeUrl", e.target.value || null); if (e.target.value) setFieldErrors((p) => ({ ...p, resumeUrl: false })); }}
                className={inputCls("resumeUrl")}
                placeholder="https://hh.ru/resume/... или https://linkedin.com/in/..."
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>или загрузите файл</label>
              <label className={styles.fileButton}>
                {resumeUploading ? "Загрузка..." : "Выбрать файл"}
                <input
                  type="file"
                  accept=".pdf,.docx,image/jpeg,image/png"
                  onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "resume")}
                  hidden
                  disabled={resumeUploading}
                />
              </label>
              <span className={styles.hint}>PDF, DOCX, до 5 МБ</span>
            </div>
          </div>
        </section>

        {/* Секция 1: Основная информация */}
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
              <label className={styles.label}>Место работы *</label>
              <input
                type="text"
                value={profile.workplace}
                onChange={(e) => { updateField("workplace", e.target.value); if (e.target.value) setFieldErrors((p) => ({ ...p, workplace: false })); }}
                className={inputCls("workplace")}
                placeholder="МФТИ, Сколтех, ВШЭ..."
                />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Должность *</label>
              <input
                type="text"
                value={profile.position}
                onChange={(e) => { updateField("position", e.target.value); if (e.target.value) setFieldErrors((p) => ({ ...p, position: false })); }}
                className={inputCls("position")}
                placeholder="Профессор кафедры..."
                />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Учёное звание *</label>
              <select
                value={profile.academicTitle}
                onChange={(e) => { updateField("academicTitle", e.target.value); if (e.target.value) setFieldErrors((p) => ({ ...p, academicTitle: false })); }}
                className={selectCls("academicTitle")}
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
                onChange={(e) => { updateField("academicDegree", e.target.value); if (e.target.value) setFieldErrors((p) => ({ ...p, academicDegree: false })); }}
                className={inputCls("academicDegree")}
                placeholder="к.т.н., д.ф.-м.н...."
                />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Контакт для связи *</label>
            <input
              type="text"
              value={profile.contact}
              onChange={(e) => { updateField("contact", e.target.value); if (e.target.value) setFieldErrors((p) => ({ ...p, contact: false })); }}
              className={inputCls("contact")}
              placeholder="E-mail, Telegram или телефон"
            />
          </div>
        </section>

        {/* Секция 2: Экспертиза и направления */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Экспертиза и магистратуры</h2>

          <div className={fieldCls("expertise")}>
            <label className={styles.label}>Доменная экспертиза * <span className={styles.hint}>Введите теги через Enter</span></label>
            <div className={styles.tagsInput}>
              {profile.expertise.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                      <button type="button" onClick={() => removeExpertise(tag)} className={styles.tagRemove}>×</button>
                </span>
              ))}
              <input
                type="text"
                value={expertiseInput}
                onChange={(e) => setExpertiseInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExpertise(); setFieldErrors((p) => ({ ...p, expertise: false })); } }}
                className={styles.tagInput}
                placeholder={profile.expertise.length === 0 ? "ML, NLP, Computer Vision..." : ""}
              />
            </div>
          </div>

          <div className={fieldCls("directions")}>
            <label className={styles.label}>Магистратуры студентов *</label>
            <p className={styles.fieldHint}>Направления, с которыми вы готовы работать</p>
            <div className={styles.checkboxGroup}>
              {DIRECTIONS.map((dir) => (
                <label key={dir} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={profile.directions.includes(dir)}
                    onChange={() => { toggleArrayItem("directions", dir); setFieldErrors((p) => ({ ...p, directions: false })); }}
                        />
                  <span>{dir}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={fieldCls("projectTypes")}>
            <label className={styles.label}>С какими типами проектов работаете *</label>
            <div className={styles.checkboxGroup}>
              {PROJECT_TYPES.map((pt) => (
                <label key={pt.value} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={profile.projectTypes.includes(pt.value)}
                    onChange={() => { toggleArrayItem("projectTypes", pt.value); setFieldErrors((p) => ({ ...p, projectTypes: false })); }}
                  />
                  <span>{pt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Предлагаемые темы и идеи</label>
            <p className={styles.fieldHint}>
              Вы можете предложить идеи стартапов или исследований для студентов — если студенту откликнется ваша идея, он может взять её в работу. Вы также можете предложить корпоративный стартап или исследование для компании, но в этом случае укажите, для какой компании.
            </p>
            <textarea
              value={profile.proposedTopics || ""}
              onChange={(e) => updateField("proposedTopics", e.target.value)}
              className={styles.textarea}
              rows={4}
              placeholder="Опишите темы, которые готовы предложить студентам..."
            />
          </div>

          <div className={styles.field} style={{ maxWidth: 200 }}>
            <label className={styles.label}>Макс. проектов (1–4)</label>
            <p className={styles.fieldHint}>Суммарное количество проектов: ваших и под руководством</p>
            <input
              type="number"
              value={profile.maxProjects}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 1;
                updateField("maxProjects", Math.min(4, Math.max(1, v)));
              }}
              className={styles.input}
              min={1}
              max={4}
            />
          </div>

          {/* Приём новых проектов — тумблер */}
          {profile.status && (
            <div className={styles.field}>
              <label className={styles.label}>Приём новых проектов</label>
              <p className={styles.fieldHint}>
                Когда выключено — студенты не смогут предложить вам проект и каталог будет показывать «Набор закрыт». Если все слоты заняты — приём блокируется автоматически независимо от настройки.
              </p>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={profile.recruitmentStatus !== "CLOSED"}
                  onChange={async (e) => {
                    const newStatus = e.target.checked ? "OPEN" : "CLOSED";
                    updateField("recruitmentStatus", newStatus);
                    try {
                      await fetch("/api/profile/supervisor", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ recruitmentStatus: newStatus }),
                      });
                    } catch { /* ignore */ }
                  }}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: 15, fontWeight: 600, color: profile.recruitmentStatus === "CLOSED" ? "#888" : "#2e7d32" }}>
                  {profile.recruitmentStatus === "CLOSED" ? "Набор закрыт" : "Принимаю новые проекты"}
                </span>
              </label>
            </div>
          )}
        </section>

        {/* Секция 3: Фото */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Фото</h2>

          <div className={styles.field}>
            {profile.photoUrl && (
              <div className={styles.filePreview}>
                <img src={profile.photoUrl} alt="Фото" className={styles.photoPreview} />
              </div>
            )}
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
            <span className={styles.hint}>JPG, PNG, до 5 МБ</span>
          </div>
        </section>

        {/* Соглашение (01.06) */}
        <section className={`${styles.section} ${fieldErrors.agreement ? styles.fieldErrorContainer : ""}`}>
          <label className={styles.agreementLabel}>
            <input
              type="checkbox"
              checked={agreement}
              onChange={(e) => { setAgreement(e.target.checked); if (e.target.checked) setFieldErrors((p) => ({ ...p, agreement: false })); }}
            />
            <span>
              Я даю согласие на <a href="https://mipt.ru/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-deep-blue)", textDecoration: "underline" }}>обработку персональных данных</a> в соответствии с политикой конфиденциальности *
            </span>
          </label>
        </section>

        {/* Сообщения */}
        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}

        {/* Кнопка сохранения */}
        <div className={styles.actions}>
          <button onClick={handleSave} className={styles.submitButton} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить профиль"}
          </button>
        </div>
      </div>
    </div>
  );
}
