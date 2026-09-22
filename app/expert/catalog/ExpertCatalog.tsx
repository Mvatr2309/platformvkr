"use client";

import { useEffect, useState, useCallback } from "react";
import { useDictionaries } from "@/lib/useDictionary";
import styles from "./catalog.module.css";

// FR-08: каталог экспертов для студента (08.10).
// Контактов в данных нет — сервер их не отдаёт (08.11).

const PROJECT_TYPES = [
  { value: "CLASSIC_DISSERTATION", label: "Исследования" },
  { value: "STARTUP", label: "Стартапы" },
  { value: "CORPORATE_STARTUP", label: "Корпоративные стартапы" },
];

type Expert = {
  id: string;
  workplace: string;
  position: string;
  academicTitle: string;
  academicDegree: string;
  photoUrl: string | null;
  resumeUrl: string | null;
  expertise: string[];
  helpTopics: string | null;
  directions: string[];
  projectTypes: string[];
  user: { name: string };
};

export default function ExpertCatalog() {
  const dicts = useDictionaries("directions");
  const DIRECTIONS = dicts.directions || [];

  const [experts, setExperts] = useState<Expert[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expertise, setExpertise] = useState("");
  const [direction, setDirection] = useState("");
  const [projectType, setProjectType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (expertise) qs.set("expertise", expertise);
    if (direction) qs.set("direction", direction);
    if (projectType) qs.set("projectType", projectType);
    try {
      const res = await fetch(`/api/expert/catalog?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExperts(data.experts || []);
        setTags(data.tags || []);
      }
    } catch {
      /* пустой список покажет сообщение */
    } finally {
      setLoading(false);
    }
  }, [search, expertise, direction, projectType]);

  // Поиск с задержкой, чтобы не дёргать сервер на каждую букву
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const hasFilters = Boolean(search || expertise || direction || projectType);

  function reset() {
    setSearch("");
    setExpertise("");
    setDirection("");
    setProjectType("");
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Каталог экспертов</h1>
      <p className={styles.subtitle}>
        Найдите эксперта по теме и отправьте запрос на консультацию. Контакты эксперта
        откроются после того, как он примет ваш запрос.
      </p>

      <div className={styles.filters}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени, компании, должности или теме"
          className={styles.searchInput}
        />
        <div className={styles.filterRow}>
          <select value={expertise} onChange={(e) => setExpertise(e.target.value)} className={styles.select}>
            <option value="">Все темы</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={direction} onChange={(e) => setDirection(e.target.value)} className={styles.select}>
            <option value="">Все направления</option>
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={styles.select}>
            <option value="">Все типы проектов</option>
            {PROJECT_TYPES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button type="button" onClick={reset} className={styles.clearButton}>
              Сбросить
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className={styles.empty}>Загружаем каталог…</p>
      ) : experts.length === 0 ? (
        <p className={styles.empty}>
          {hasFilters
            ? "По таким условиям экспертов нет. Попробуйте снять часть фильтров."
            : "Пока в каталоге нет ни одного эксперта. Загляните позже."}
        </p>
      ) : (
        <>
          <p className={styles.count}>Найдено: {experts.length}</p>
          <div className={styles.grid}>
            {experts.map((e) => (
              <a key={e.id} href={`/expert/catalog/${e.id}`} className={styles.card}>
                <div className={styles.cardTop}>
                  {e.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.photoUrl} alt="" className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {(e.user.name || "?").charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className={styles.cardName}>{e.user.name || "Без имени"}</div>
                    <div className={styles.cardMeta}>
                      {[e.position, e.workplace].filter(Boolean).join(" · ")}
                    </div>
                    {(e.academicTitle || e.academicDegree) && (
                      <div className={styles.cardDegree}>
                        {[e.academicTitle, e.academicDegree].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </div>

                {e.helpTopics && <p className={styles.cardTopics}>{e.helpTopics}</p>}

                {e.expertise.length > 0 && (
                  <div className={styles.cardTags}>
                    {e.expertise.slice(0, 4).map((t) => (
                      <span key={t} className={styles.tag}>{t}</span>
                    ))}
                    {e.expertise.length > 4 && (
                      <span className={styles.tagMore}>+{e.expertise.length - 4}</span>
                    )}
                  </div>
                )}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
