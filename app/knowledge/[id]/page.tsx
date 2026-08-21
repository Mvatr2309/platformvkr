"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import styles from "../knowledge.module.css";

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  type: string;
  visibleToStudents: boolean;
  visibleToSupervisors: boolean;
  createdAt: string;
  updatedAt: string;
  files: Array<{ id: string; filename: string; filepath: string; uploadedAt: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  REGULATION: "Регламенты",
  TEMPLATE: "Шаблоны",
  FAQ: "FAQ",
  INSTRUCTION: "Инструкции",
};

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "",
    visibleToStudents: true,
    visibleToSupervisors: true,
  });
  const [uploading, setUploading] = useState(false);
  const [fileTitle, setFileTitle] = useState("");
  const [error, setError] = useState("");

  const fetchArticle = useCallback(async () => {
    const res = await fetch(`/api/knowledge/${id}`);
    if (res.ok) {
      const data = await res.json();
      setArticle(data);
      setForm({
        title: data.title,
        content: data.content,
        category: data.category,
        visibleToStudents: data.visibleToStudents,
        visibleToSupervisors: data.visibleToSupervisors,
      });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchArticle(); }, [fetchArticle]);

  const isAdmin = session?.user?.role === "ADMIN";
  const isFile = article?.type === "FILE";

  async function handleSave() {
    setError("");
    const res = await fetch(`/api/knowledge/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setEditing(false);
      fetchArticle();
    } else {
      const data = await res.json();
      setError(data.error || "Ошибка сохранения");
    }
  }

  async function handleDelete() {
    if (!confirm("Удалить материал?")) return;
    const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/knowledge");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const fd = new FormData();
    fd.append("file", file);
    if (fileTitle.trim()) fd.append("title", fileTitle.trim());

    const res = await fetch(`/api/knowledge/${id}/files`, { method: "POST", body: fd });
    if (res.ok) {
      setFileTitle("");
      fetchArticle();
    }
    setUploading(false);
    e.target.value = "";
  }

  if (loading) return <div className={styles.page}><p>Загрузка...</p></div>;
  if (!article) return <div className={styles.page}><p>Статья не найдена</p></div>;

  return (
    <div className={styles.page}>
      <a href="/knowledge" className={styles.backLink}>← База знаний</a>

      {error && <p className={styles.error}>{error}</p>}

      {editing && isAdmin ? (
        <div className={styles.editorForm}>
          <div className={styles.formGroup}>
            <label>Название</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Категория</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {!isFile && (
            <div className={styles.formGroup}>
              <label>Содержимое</label>
              <RichTextEditor
                value={form.content}
                onChange={(html) => setForm((f) => ({ ...f, content: html }))}
              />
            </div>
          )}
          <div className={styles.formGroup}>
            <label>Видимость</label>
            <div className={styles.choiceRow}>
              <label className={styles.choiceLabel}>
                <input
                  type="checkbox"
                  checked={form.visibleToStudents}
                  onChange={(e) => setForm({ ...form, visibleToStudents: e.target.checked })}
                />
                Видно студентам
              </label>
              <label className={styles.choiceLabel}>
                <input
                  type="checkbox"
                  checked={form.visibleToSupervisors}
                  onChange={(e) => setForm({ ...form, visibleToSupervisors: e.target.checked })}
                />
                Видно научным руководителям
              </label>
            </div>
          </div>
          <div className={styles.formActions}>
            <button onClick={() => setEditing(false)} className={styles.cancelBtn}>Отмена</button>
            <button onClick={handleSave} className={styles.saveBtn}>Сохранить</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-md)", marginBottom: "var(--space-md)" }}>
            <div style={{ flex: 1 }}>
              <h1 className={styles.articleTitle}>{article.title}</h1>
              <div className={styles.articleMeta}>
                <span className={`${styles.categoryBadge} ${styles[`badge_${article.category}`] || ""}`}>
                  {CATEGORY_LABELS[article.category]}
                </span>
                {" · "}
                Обновлено {new Date(article.updatedAt).toLocaleDateString("ru-RU")}
              </div>
              {isAdmin && (
                <div className={styles.visRow}>
                  <span className={`${styles.visBadge} ${article.visibleToStudents ? styles.visOn : styles.visOff}`}>
                    {article.visibleToStudents ? "✓" : "✕"} Студенты
                  </span>
                  <span className={`${styles.visBadge} ${article.visibleToSupervisors ? styles.visOn : styles.visOff}`}>
                    {article.visibleToSupervisors ? "✓" : "✕"} НР
                  </span>
                </div>
              )}
            </div>
            {isAdmin && (
              <div style={{ display: "flex", gap: "var(--space-sm)", flexShrink: 0 }}>
                <button onClick={() => setEditing(true)} className={styles.editBtn}>Редактировать</button>
                <button onClick={handleDelete} className={styles.deleteBtn}>Удалить</button>
              </div>
            )}
          </div>

          {!isFile && (
            <div
              className={styles.articleContent}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          )}
        </>
      )}

      {/* Files / templates (07.04) */}
      <div className={styles.filesSection}>
        <h3 className={styles.filesTitle}>Файлы и шаблоны</h3>
        {article.files.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>Нет прикреплённых файлов</p>
        ) : (
          <div className={styles.fileList}>
            {article.files.map((f) => (
              <div key={f.id} className={styles.fileItem}>
                <a
                  href={`/api/knowledge/${id}/files/${f.id}/download`}
                  className={styles.fileLink}
                >
                  {f.filename}
                </a>
                <span className={styles.fileDate}>
                  {new Date(f.uploadedAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className={styles.uploadRow}>
            <input
              className={styles.fileTitleInput}
              value={fileTitle}
              onChange={(e) => setFileTitle(e.target.value)}
              placeholder="Название файла (по умолчанию — имя файла)"
            />
            <label className={styles.uploadBtn}>
              {uploading ? "Загрузка..." : "Загрузить файл"}
              <input type="file" onChange={handleFileUpload} hidden disabled={uploading} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
