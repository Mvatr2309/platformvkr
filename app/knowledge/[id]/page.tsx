"use client";

import { useState, useEffect, useCallback, use, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import styles from "../knowledge.module.css";

interface TocPage { id: string; title: string; sortOrder: number }
interface TocChapter { id: string; title: string; sortOrder: number; children: TocPage[] }

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  type: string;
  parentId: string | null;
  visibleToStudents: boolean;
  visibleToSupervisors: boolean;
  createdAt: string;
  updatedAt: string;
  files: Array<{ id: string; filename: string; filepath: string; uploadedAt: string }>;
  book: { rootId: string; rootTitle: string; chapters: TocChapter[] } | null;
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
  const [showToc, setShowToc] = useState(false);
  // Панель структуры книги (админ)
  const [newChapter, setNewChapter] = useState("");
  const [newPageFor, setNewPageFor] = useState<string | null>(null);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [structBusy, setStructBusy] = useState(false);

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
    } else {
      setArticle(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchArticle(); setShowToc(false); setEditing(false); }, [fetchArticle]);

  const isAdmin = session?.user?.role === "ADMIN";
  const isFile = article?.type === "FILE";
  const book = article?.book || null;
  const isBookRoot = !!book && article?.id === book.rootId;
  const isChild = !!article?.parentId;

  // Сквозной порядок страниц книги для «предыдущая/следующая»
  const flatOrder = useMemo(() => {
    if (!book) return [];
    const seq: Array<{ id: string; title: string }> = [{ id: book.rootId, title: book.rootTitle }];
    for (const ch of book.chapters) {
      seq.push({ id: ch.id, title: ch.title });
      for (const p of ch.children) seq.push({ id: p.id, title: p.title });
    }
    return seq;
  }, [book]);
  const flatIdx = flatOrder.findIndex((x) => x.id === id);
  const prevPage = flatIdx > 0 ? flatOrder[flatIdx - 1] : null;
  const nextPage = flatIdx >= 0 && flatIdx < flatOrder.length - 1 ? flatOrder[flatIdx + 1] : null;

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
    const isBook = article?.type === "BOOK";
    if (!confirm(isBook ? "Удалить книгу вместе со всеми главами и страницами?" : "Удалить материал?")) return;
    const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (res.ok) {
      // Удаление главы/страницы возвращает в книгу, материала — в базу знаний
      router.push(isChild && book ? `/knowledge/${book.rootId}` : "/knowledge");
    }
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

  // === Структура книги (админ) ===
  async function createChild(parentId: string, title: string) {
    if (!title.trim()) return;
    setStructBusy(true);
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), parentId }),
    });
    if (res.ok) {
      setNewChapter("");
      setNewPageTitle("");
      setNewPageFor(null);
      fetchArticle();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не удалось создать");
    }
    setStructBusy(false);
  }

  async function deleteNode(nodeId: string, label: string) {
    if (!confirm(`Удалить «${label}» со всем содержимым?`)) return;
    setStructBusy(true);
    const res = await fetch(`/api/knowledge/${nodeId}`, { method: "DELETE" });
    if (res.ok) fetchArticle();
    setStructBusy(false);
  }

  // Перестановка соседних элементов местами (кнопки ↑/↓)
  async function swapNodes(a: { id: string; sortOrder: number }, b: { id: string; sortOrder: number }, idx: number) {
    setStructBusy(true);
    // При совпадении sortOrder (старые данные) — разносим по индексам
    const aOrder = a.sortOrder === b.sortOrder ? idx + 1 : b.sortOrder;
    const bOrder = a.sortOrder === b.sortOrder ? idx : a.sortOrder;
    await fetch(`/api/knowledge/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: aOrder }),
    });
    await fetch(`/api/knowledge/${b.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: bOrder }),
    });
    fetchArticle();
    setStructBusy(false);
  }

  if (loading) return <div className={styles.page}><p>Загрузка...</p></div>;
  if (!article) return <div className={styles.page}><p>Статья не найдена</p></div>;

  const toc = book && (
    <nav className={styles.toc}>
      <a
        href={`/knowledge/${book.rootId}`}
        className={`${styles.tocRoot} ${id === book.rootId ? styles.tocActive : ""}`}
      >
        {book.rootTitle}
      </a>
      {book.chapters.map((ch) => (
        <div key={ch.id}>
          <a
            href={`/knowledge/${ch.id}`}
            className={`${styles.tocChapter} ${id === ch.id ? styles.tocActive : ""}`}
          >
            {ch.title}
          </a>
          {ch.children.map((p) => (
            <a
              key={p.id}
              href={`/knowledge/${p.id}`}
              className={`${styles.tocPage} ${id === p.id ? styles.tocActive : ""}`}
            >
              {p.title}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );

  const content = (
    <>
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
          {/* Категория и видимость наследуются от книги — у глав/страниц их не редактируем */}
          {!isChild && (
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
          )}
          {!isFile && (
            <div className={styles.formGroup}>
              <label>{article.type === "BOOK" ? "Описание книги (титульная страница)" : "Содержимое"}</label>
              <RichTextEditor
                value={form.content}
                onChange={(html) => setForm((f) => ({ ...f, content: html }))}
              />
            </div>
          )}
          {!isChild && (
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
          )}
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
                {!isChild && (
                  <>
                    <span className={`${styles.categoryBadge} ${styles[`badge_${article.category}`] || ""}`}>
                      {CATEGORY_LABELS[article.category]}
                    </span>
                    {" · "}
                  </>
                )}
                Обновлено {new Date(article.updatedAt).toLocaleDateString("ru-RU")}
              </div>
              {isAdmin && !isChild && (
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

      {/* Структура книги — панель админа на титульной странице */}
      {isAdmin && isBookRoot && book && !editing && (
        <div className={styles.structPanel}>
          <h3 className={styles.filesTitle}>Структура книги</h3>
          {book.chapters.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>Пока нет глав</p>
          )}
          {book.chapters.map((ch, ci) => (
            <div key={ch.id} className={styles.structChapter}>
              <div className={styles.structRow}>
                <a href={`/knowledge/${ch.id}`} className={styles.structLink}>{ch.title}</a>
                <span className={styles.structActions}>
                  <button disabled={structBusy || ci === 0} onClick={() => swapNodes(book.chapters[ci - 1], ch, ci - 1)} title="Выше">↑</button>
                  <button disabled={structBusy || ci === book.chapters.length - 1} onClick={() => swapNodes(ch, book.chapters[ci + 1], ci)} title="Ниже">↓</button>
                  <button disabled={structBusy} onClick={() => setNewPageFor(newPageFor === ch.id ? null : ch.id)} title="Добавить страницу">+ стр.</button>
                  <button disabled={structBusy} onClick={() => deleteNode(ch.id, ch.title)} title="Удалить главу" className={styles.structDelete}>✕</button>
                </span>
              </div>
              {ch.children.map((p, pi) => (
                <div key={p.id} className={`${styles.structRow} ${styles.structPageRow}`}>
                  <a href={`/knowledge/${p.id}`} className={styles.structLink}>{p.title}</a>
                  <span className={styles.structActions}>
                    <button disabled={structBusy || pi === 0} onClick={() => swapNodes(ch.children[pi - 1], p, pi - 1)} title="Выше">↑</button>
                    <button disabled={structBusy || pi === ch.children.length - 1} onClick={() => swapNodes(p, ch.children[pi + 1], pi)} title="Ниже">↓</button>
                    <button disabled={structBusy} onClick={() => deleteNode(p.id, p.title)} title="Удалить страницу" className={styles.structDelete}>✕</button>
                  </span>
                </div>
              ))}
              {newPageFor === ch.id && (
                <div className={styles.structAddRow}>
                  <input
                    value={newPageTitle}
                    onChange={(e) => setNewPageTitle(e.target.value)}
                    placeholder="Название страницы"
                    onKeyDown={(e) => e.key === "Enter" && createChild(ch.id, newPageTitle)}
                  />
                  <button disabled={structBusy} onClick={() => createChild(ch.id, newPageTitle)}>Добавить</button>
                </div>
              )}
            </div>
          ))}
          <div className={styles.structAddRow}>
            <input
              value={newChapter}
              onChange={(e) => setNewChapter(e.target.value)}
              placeholder="Название новой главы"
              onKeyDown={(e) => e.key === "Enter" && createChild(book.rootId, newChapter)}
            />
            <button disabled={structBusy} onClick={() => createChild(book.rootId, newChapter)}>+ Глава</button>
          </div>
        </div>
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

      {/* Навигация по книге */}
      {book && (prevPage || nextPage) && (
        <div className={styles.bookNav}>
          {prevPage ? (
            <a href={`/knowledge/${prevPage.id}`} className={styles.bookNavLink}>← {prevPage.title}</a>
          ) : <span />}
          {nextPage ? (
            <a href={`/knowledge/${nextPage.id}`} className={styles.bookNavLink} style={{ textAlign: "right" }}>{nextPage.title} →</a>
          ) : <span />}
        </div>
      )}
    </>
  );

  if (book) {
    return (
      <div className={styles.page}>
        <a href="/knowledge" className={styles.backLink}>← База знаний</a>
        <button className={styles.tocToggle} onClick={() => setShowToc(!showToc)}>
          ☰ Оглавление
        </button>
        <div className={styles.bookLayout}>
          <aside className={`${styles.tocAside} ${showToc ? styles.tocAsideOpen : ""}`}>
            {toc}
          </aside>
          <div className={`${styles.bookContent} ${styles.contentCard}`}>{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <a href="/knowledge" className={styles.backLink}>← База знаний</a>
      <div className={styles.contentCard}>{content}</div>
    </div>
  );
}
