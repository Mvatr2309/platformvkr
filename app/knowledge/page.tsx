"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Pagination, { usePagination } from "@/components/Pagination";
import RichTextEditor from "@/components/RichTextEditor";
import styles from "./knowledge.module.css";

interface ArticleItem {
  id: string;
  title: string;
  category: string;
  type: string;
  parentId: string | null;
  visibleToStudents: boolean;
  visibleToSupervisors: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { files: number; children: number };
  files: Array<{ id: string; filename: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  REGULATION: "Регламенты",
  TEMPLATE: "Шаблоны",
  FAQ: "FAQ",
  INSTRUCTION: "Инструкции",
};

const ALL_CATEGORIES = ["", "REGULATION", "TEMPLATE", "FAQ", "INSTRUCTION"];

const EMPTY_FORM = {
  title: "",
  content: "",
  category: "REGULATION",
  type: "ARTICLE",
  visibleToStudents: true,
  visibleToSupervisors: true,
  fileTitle: "",
};

export default function KnowledgePage() {
  const { data: session } = useSession();
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchArticles = useCallback(async () => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);

    const res = await fetch(`/api/knowledge?${params}`);
    if (res.ok) setArticles(await res.json());
    setLoading(false);
  }, [category, search]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMessage("");

    if (form.type === "FILE" && !createFile) {
      setError("Выберите файл для загрузки");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          category: form.category,
          type: form.type,
          visibleToStudents: form.visibleToStudents,
          visibleToSupervisors: form.visibleToSupervisors,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка");
        return;
      }

      const article = await res.json();

      // Книга: сразу переходим на её страницу — добавлять главы
      if (form.type === "BOOK") {
        window.location.href = `/knowledge/${article.id}`;
        return;
      }

      // Для материала-файла — сразу грузим сам файл; при неудаче откатываем материал
      if (form.type === "FILE" && createFile) {
        const fd = new FormData();
        fd.append("file", createFile);
        if (form.fileTitle.trim()) fd.append("title", form.fileTitle.trim());

        const up = await fetch(`/api/knowledge/${article.id}/files`, {
          method: "POST",
          body: fd,
        });
        if (!up.ok) {
          await fetch(`/api/knowledge/${article.id}`, { method: "DELETE" });
          const data = await up.json().catch(() => ({}));
          setError(data.error || "Не удалось загрузить файл");
          return;
        }
      }

      setMessage(form.type === "FILE" ? "Файл добавлен" : "Статья создана");
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      setCreateFile(null);
      fetchArticles();
    } finally {
      setSaving(false);
    }
  }

  const isAdmin = session?.user?.role === "ADMIN";

  const { page, setPage, totalPages, paged } = usePagination(articles, 20);

  useEffect(() => {
    setPage(1);
  }, [category, search]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>База знаний</h1>

      {message && <p className={styles.success}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="Поиск по статьям..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {isAdmin && (
          <button onClick={() => setShowCreate(!showCreate)} className={styles.createBtn}>
            + Материал
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && isAdmin && (
        <form onSubmit={handleCreate} className={styles.editorForm}>
          <div className={styles.formGroup}>
            <label>Формат материала</label>
            <div className={styles.choiceRow}>
              <label className={styles.choiceLabel}>
                <input
                  type="radio"
                  name="materialType"
                  checked={form.type === "ARTICLE"}
                  onChange={() => setForm({ ...form, type: "ARTICLE" })}
                />
                Статья
              </label>
              <label className={styles.choiceLabel}>
                <input
                  type="radio"
                  name="materialType"
                  checked={form.type === "FILE"}
                  onChange={() => setForm({ ...form, type: "FILE" })}
                />
                Файл для скачивания
              </label>
              <label className={styles.choiceLabel}>
                <input
                  type="radio"
                  name="materialType"
                  checked={form.type === "BOOK"}
                  onChange={() => setForm({ ...form, type: "BOOK" })}
                />
                Книга (главы и страницы)
              </label>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>Название</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
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
          {form.type === "ARTICLE" || form.type === "BOOK" ? (
            <div className={styles.formGroup}>
              <label>{form.type === "BOOK" ? "Описание книги (титульная страница, необязательно)" : "Содержимое"}</label>
              <RichTextEditor
                value={form.content}
                onChange={(html) => setForm((f) => ({ ...f, content: html }))}
              />
            </div>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label>Файл (макс. 20 МБ)</label>
                <input
                  type="file"
                  onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Название файла (как его увидят пользователи)</label>
                <input
                  value={form.fileTitle}
                  onChange={(e) => setForm({ ...form, fileTitle: e.target.value })}
                  placeholder="По умолчанию — имя загружаемого файла"
                />
              </div>
            </>
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
            <button type="button" onClick={() => setShowCreate(false)} className={styles.cancelBtn}>
              Отмена
            </button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? "Сохранение..." : "Создать"}
            </button>
          </div>
        </form>
      )}

      {/* Category tabs */}
      <div className={styles.tabs}>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat || "all"}
            onClick={() => setCategory(cat)}
            className={`${styles.tab} ${category === cat ? styles.tabActive : ""}`}
          >
            {cat ? CATEGORY_LABELS[cat] : "Все"}
          </button>
        ))}
      </div>

      {/* Articles list */}
      {loading ? (
        <p>Загрузка...</p>
      ) : articles.length === 0 ? (
        <p className={styles.empty}>
          {search ? "Ничего не найдено" : "Статей пока нет"}
        </p>
      ) : (
        <>
        <div className={styles.list}>
          {paged.map((a) => {
            const isFile = a.type === "FILE";
            const fileId = a.files[0]?.id;
            const downloadUrl =
              isFile && fileId ? `/api/knowledge/${a.id}/files/${fileId}/download` : null;
            // Материал-файл скачивается прямо с карточки; админ переходит на страницу управления
            const href = isFile && !isAdmin && downloadUrl ? downloadUrl : `/knowledge/${a.id}`;
            return (
              <a key={a.id} href={href} className={styles.card}>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{a.title}</div>
                  <div className={styles.cardMeta}>
                    {new Date(a.updatedAt).toLocaleDateString("ru-RU")}
                    {a.type === "BOOK" && ` · книга · глав: ${a._count.children}`}
                    {a.parentId && " · страница книги"}
                    {isFile
                      ? " · файл для скачивания"
                      : a._count.files > 0 && ` · ${a._count.files} файл(ов)`}
                  </div>
                  {isAdmin && (
                    <div className={styles.visRow}>
                      <span
                        className={`${styles.visBadge} ${a.visibleToStudents ? styles.visOn : styles.visOff}`}
                      >
                        {a.visibleToStudents ? "✓" : "✕"} Студенты
                      </span>
                      <span
                        className={`${styles.visBadge} ${a.visibleToSupervisors ? styles.visOn : styles.visOff}`}
                      >
                        {a.visibleToSupervisors ? "✓" : "✕"} НР
                      </span>
                    </div>
                  )}
                </div>
                {isFile && downloadUrl && isAdmin && (
                  <span
                    className={styles.downloadBtn}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = downloadUrl;
                    }}
                  >
                    Скачать
                  </span>
                )}
                {isFile && !isAdmin && (
                  <span className={styles.downloadBtn}>Скачать</span>
                )}
                <span className={`${styles.categoryBadge} ${styles[`badge_${a.category}`] || ""}`}>
                  {CATEGORY_LABELS[a.category] || a.category}
                </span>
              </a>
            );
          })}
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
