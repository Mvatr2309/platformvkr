"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "./knowledge.module.css";

interface ArticleItem {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  _count: { files: number };
}

const CATEGORY_LABELS: Record<string, string> = {
  REGULATION: "Регламенты",
  TEMPLATE: "Шаблоны",
  FAQ: "FAQ",
  INSTRUCTION: "Инструкции",
};

const ALL_CATEGORIES = ["", "REGULATION", "TEMPLATE", "FAQ", "INSTRUCTION"];

export default function KnowledgePage() {
  const { data: session } = useSession();
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "REGULATION" });
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

    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setMessage("Статья создана");
      setShowCreate(false);
      setForm({ title: "", content: "", category: "REGULATION" });
      fetchArticles();
    } else {
      const data = await res.json();
      setError(data.error || "Ошибка");
    }
  }

  const isAdmin = session?.user?.role === "ADMIN";

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
            + Статья
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && isAdmin && (
        <form onSubmit={handleCreate} className={styles.editorForm}>
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
          <div className={styles.formGroup}>
            <label>Содержимое (HTML)</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="<h2>Заголовок</h2><p>Текст статьи...</p>"
              required
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setShowCreate(false)} className={styles.cancelBtn}>
              Отмена
            </button>
            <button type="submit" className={styles.saveBtn}>Создать</button>
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
        <div className={styles.list}>
          {articles.map((a) => (
            <a key={a.id} href={`/knowledge/${a.id}`} className={styles.card}>
              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>{a.title}</div>
                <div className={styles.cardMeta}>
                  {new Date(a.updatedAt).toLocaleDateString("ru-RU")}
                  {a._count.files > 0 && ` · ${a._count.files} файл(ов)`}
                </div>
              </div>
              <span className={`${styles.categoryBadge} ${styles[`badge_${a.category}`] || ""}`}>
                {CATEGORY_LABELS[a.category] || a.category}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
