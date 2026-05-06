"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useDictionaries } from "@/lib/useDictionary";
import styles from "./new-project.module.css";

const PROJECT_TYPES = [
  { value: "CLASSIC_DISSERTATION", label: "Исследование" },
  { value: "STARTUP", label: "Стартап" },
  { value: "CORPORATE_STARTUP", label: "Корпоративный стартап" },
];

export default function NewProjectPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const dicts = useDictionaries("directions", "roles");
  const DIRECTIONS = dicts.directions || [];
  const ROLES = dicts.roles || [];
  type MemberDraft = { name: string; email: string; direction: string; role: string };
  const isStudent = session?.user?.role === "STUDENT";
  const [limitReached, setLimitReached] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");
  const [checkingLimit, setCheckingLimit] = useState(true);

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      try {
        const res = await fetch("/api/projects/check-limit");
        if (res.ok) {
          const data = await res.json();
          if (data.limitReached) {
            setLimitReached(true);
            setLimitMessage(data.message);
          }
        }
      } catch { /* ignore */ }
      setCheckingLimit(false);
    })();
  }, [session]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("");
  const [direction, setDirection] = useState("");
  const [requiredRoles, setRequiredRoles] = useState<string[]>([]);
  const [authorRole, setAuthorRole] = useState("");
  const [contact, setContact] = useState("");
  const [files, setFiles] = useState<{ name: string; url: string; fileType: "FILE" | "LINK" }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [addMode, setAddMode] = useState<"FILE" | "LINK">("FILE");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [memberForm, setMemberForm] = useState<MemberDraft>({ name: "", email: "", direction: "", role: "" });
  const [memberError, setMemberError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const inputCls = (f: string) => `${styles.input} ${fieldErrors[f] ? styles.inputError : ""}`;
  const textareaCls = (f: string) => `${styles.textarea} ${fieldErrors[f] ? styles.textareaError : ""}`;
  const typeGroupCls = (f: string) => `${styles.typeGroup} ${fieldErrors[f] ? styles.fieldErrorContainer : ""}`;

  function addMember() {
    setMemberError("");
    if (!memberForm.name || !memberForm.email || !memberForm.role) {
      setMemberError("ФИО, e-mail и роль обязательны");
      return;
    }
    if (members.some((m) => m.email.toLowerCase() === memberForm.email.toLowerCase())) {
      setMemberError("Участник с таким e-mail уже добавлен");
      return;
    }
    setMembers((prev) => [...prev, memberForm]);
    setMemberForm({ name: "", email: "", direction: "", role: "" });
  }

  function removeMember(email: string) {
    setMembers((prev) => prev.filter((m) => m.email !== email));
  }

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
        setFiles((prev) => [...prev, { name: file.name, url: data.url, fileType: "FILE" }]);
      } else {
        setError(data.error || "Ошибка загрузки файла");
      }
    } catch {
      setError("Ошибка загрузки файла");
    } finally {
      setUploading(false);
    }
  }

  function addLink() {
    setLinkError("");
    const title = linkTitle.trim();
    const url = linkUrl.trim();
    if (!title) { setLinkError("Укажите название документа"); return; }
    if (!url) { setLinkError("Укажите ссылку"); return; }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setLinkError("Ссылка должна начинаться с http:// или https://");
      return;
    }
    setFiles((prev) => [...prev, { name: title, url, fileType: "LINK" }]);
    setLinkTitle("");
    setLinkUrl("");
  }

  function removeFile(url: string) {
    setFiles((prev) => prev.filter((f) => f.url !== url));
  }

  async function handleSave(submit: boolean) {
    const errs: Record<string, boolean> = {};
    if (!title.trim()) errs.title = true;
    if (!description.trim()) errs.description = true;
    if (!projectType) errs.projectType = true;
    if (!contact.trim()) errs.contact = true;

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError("Заполните выделенные поля");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
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
          title, description, projectType, direction, requiredRoles, authorRole, contact, submit, files, members,
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

  if (checkingLimit) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (limitReached) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <h1 className={styles.title}>Новый проект</h1>
          <p className={styles.error}>{limitMessage}</p>
          <button
            onClick={() => router.push("/my-projects")}
            className={styles.saveButton}
            style={{ marginTop: 16 }}
          >
            Перейти к моим проектам
          </button>
        </div>
      </div>
    );
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
              onChange={(e) => { setTitle(e.target.value); if (e.target.value) setFieldErrors((p) => ({ ...p, title: false })); }}
              className={inputCls("title")}
              placeholder="Например: Roomschool — детская онлайн-школа с ИИ"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Тип работы *</label>
            <div className={typeGroupCls("projectType")}>
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`${styles.typeOption} ${projectType === t.value ? styles.typeActive : ""}`}
                  onClick={() => { setProjectType(t.value); setFieldErrors((p) => ({ ...p, projectType: false })); }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {projectType === "CLASSIC_DISSERTATION" && (
            <div className={styles.field}>
              <label className={styles.label}>Магистратура</label>
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
              onChange={(e) => { setDescription(e.target.value); if (e.target.value) setFieldErrors((p) => ({ ...p, description: false })); }}
              className={textareaCls("description")}
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
          {/* Роли — только для стартапов */}
          {projectType !== "CLASSIC_DISSERTATION" && (
            <>
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
            </>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Контакт для связи *</label>
            <input
              type="text"
              value={contact}
              onChange={(e) => { setContact(e.target.value); if (e.target.value) setFieldErrors((p) => ({ ...p, contact: false })); }}
              className={inputCls("contact")}
              placeholder="E-mail, Telegram или телефон"
            />
          </div>
        </div>

        {projectType !== "CLASSIC_DISSERTATION" && (
          <div className={styles.section}>
            <div className={styles.field}>
              <label className={styles.label}>Команда</label>

              {members.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {members.map((m) => (
                    <div
                      key={m.email}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        border: "1px solid #e5e5e5",
                        marginBottom: 6,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div style={{ color: "#666", fontSize: 12 }}>
                          {m.email}
                          {m.role && ` · ${m.role}`}
                          {m.direction && ` · ${m.direction}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(m.email)}
                        style={{ background: "none", border: "none", color: "#E8375A", cursor: "pointer", fontSize: 18 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  className={styles.input}
                  placeholder="ФИО *"
                />
                <input
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                  className={styles.input}
                  placeholder="E-mail *"
                />
                <select
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                  className={styles.select}
                >
                  <option value="">Выберите роль *</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select
                  value={memberForm.direction}
                  onChange={(e) => setMemberForm({ ...memberForm, direction: e.target.value })}
                  className={styles.select}
                >
                  <option value="">Выберите магистратуру</option>
                  {DIRECTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              {memberError && <p className={styles.error} style={{ marginTop: 0 }}>{memberError}</p>}
              <button type="button" onClick={addMember} className={styles.saveButton}>
                + Добавить участника
              </button>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label}>Документы (паспорт проекта, презентация и др.)</label>
            {files.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {files.map((f) => (
                  <div key={f.url} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: f.fileType === "LINK" ? "#003092" : "#555", border: "1px solid", borderColor: f.fileType === "LINK" ? "#003092" : "#bbb", padding: "1px 6px" }}>
                      {f.fileType === "LINK" ? "ССЫЛКА" : "ФАЙЛ"}
                    </span>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: "#003092", fontSize: 14 }}>
                      {f.name}
                    </a>
                    <button type="button" onClick={() => removeFile(f.url)} style={{ background: "none", border: "none", color: "#E8375A", cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setAddMode("FILE")}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "1px solid #ddd",
                  background: addMode === "FILE" ? "#003092" : "#fff",
                  color: addMode === "FILE" ? "#fff" : "#555",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Загрузить файл
              </button>
              <button
                type="button"
                onClick={() => setAddMode("LINK")}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "1px solid #ddd",
                  background: addMode === "LINK" ? "#003092" : "#fff",
                  color: addMode === "LINK" ? "#fff" : "#555",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Вставить ссылку
              </button>
            </div>

            {addMode === "FILE" ? (
              <div>
                <label className={styles.saveButton} style={{ display: "inline-block", cursor: "pointer", textAlign: "center" }}>
                  {uploading ? "Загрузка..." : "Выбрать файл"}
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
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 600 }}>
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Название (напр. «Концепция в Notion»)"
                  className={styles.input}
                />
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://drive.google.com/... или https://notion.so/..."
                  className={styles.input}
                />
                {linkError && <span style={{ color: "#E8375A", fontSize: 13 }}>{linkError}</span>}
                <button
                  type="button"
                  onClick={addLink}
                  className={styles.saveButton}
                  style={{ alignSelf: "flex-start" }}
                >
                  Добавить ссылку
                </button>
              </div>
            )}
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
