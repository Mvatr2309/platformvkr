"use client";

import { useState, useEffect, useCallback } from "react";
import { useDictionaries } from "@/lib/useDictionary";
import styles from "./supervisors.module.css";

const PROJECT_TYPES = [
  { value: "CLASSIC_DISSERTATION", label: "Исследования" },
  { value: "STARTUP", label: "Стартапы" },
  { value: "CORPORATE_STARTUP", label: "Корпоративные стартапы" },
];

interface SupervisorCard {
  id: string;
  workplace: string;
  position: string;
  academicTitle: string;
  academicDegree: string;
  expertise: string[];
  directions: string[];
  projectTypes: string[];
  maxProjects: number;
  recruitmentStatus: string;
  photoUrl: string | null;
  user: { name: string };
  _count: { projects: number };
}

export default function SupervisorsPage() {
  const dicts = useDictionaries("directions", "academicTitles");
  const DIRECTIONS = dicts.directions || [];
  const ACADEMIC_TITLES = dicts.academicTitles || [];
  const [profiles, setProfiles] = useState<SupervisorCard[]>([]);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("");
  const [academicTitle, setAcademicTitle] = useState("");
  const [recruitment, setRecruitment] = useState("");
  const [projectType, setProjectType] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (direction) params.set("direction", direction);
    if (academicTitle) params.set("academicTitle", academicTitle);
    if (recruitment) params.set("recruitment", recruitment);
    if (projectType) params.set("projectType", projectType);

    const res = await fetch(`/api/supervisors?${params}`);
    if (res.ok) {
      setProfiles(await res.json());
    }
    setLoading(false);
  }, [search, direction, academicTitle, recruitment, projectType]);

  useEffect(() => {
    const timer = setTimeout(fetchProfiles, 300);
    return () => clearTimeout(timer);
  }, [fetchProfiles]);

  function clearFilters() {
    setSearch("");
    setDirection("");
    setAcademicTitle("");
    setRecruitment("");
    setProjectType("");
  }

  const hasFilters = search || direction || academicTitle || recruitment || projectType;

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Научные руководители</h1>

        {/* Поиск и фильтры */}
        <div className={styles.filters}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            placeholder="Поиск по ФИО, месту работы, темам..."
          />
          <div className={styles.filterRow}>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className={styles.select}
            >
              <option value="">Все магистратуры</option>
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={academicTitle}
              onChange={(e) => setAcademicTitle(e.target.value)}
              className={styles.select}
            >
              <option value="">Любое звание</option>
              {ACADEMIC_TITLES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className={styles.select}
            >
              <option value="">Все типы проектов</option>
              {PROJECT_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
            <select
              value={recruitment}
              onChange={(e) => setRecruitment(e.target.value)}
              className={styles.select}
            >
              <option value="">Любой статус набора</option>
              <option value="OPEN">Набор открыт</option>
              <option value="CLOSED">Набор закрыт</option>
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className={styles.clearButton}>
                Сбросить
              </button>
            )}
          </div>
        </div>

        {/* Результаты */}
        {loading ? (
          <p className={styles.empty}>Загрузка...</p>
        ) : profiles.length === 0 ? (
          <p className={styles.empty}>
            {hasFilters ? "Ничего не найдено. Попробуйте изменить фильтры." : "Пока нет подтверждённых руководителей."}
          </p>
        ) : (
          <div className={styles.grid}>
            {profiles.map((p, idx) => (
              <a key={p.id} href={`/supervisors/${p.id}`} className={styles.card} {...(idx === 0 ? { "data-onboarding": "supervisor-card" } : {})}>
                <div className={styles.cardTop}>
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt="" className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {p.user.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className={styles.cardName}>{p.user.name}</div>
                    <div className={styles.cardMeta}>
                      {p.academicDegree} · {p.position}
                    </div>
                    <div className={styles.cardMeta}>{p.workplace}</div>
                  </div>
                </div>

                <div className={styles.cardTags}>
                  {p.expertise.slice(0, 4).map((tag) => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                  {p.expertise.length > 4 && (
                    <span className={styles.tagMore}>+{p.expertise.length - 4}</span>
                  )}
                </div>

                {p.projectTypes && p.projectTypes.length > 0 && (
                  <div className={styles.projectTypes}>
                    {p.projectTypes.map((pt) => {
                      const label = PROJECT_TYPES.find((t) => t.value === pt)?.label || pt;
                      return <span key={pt} className={styles.projectTypeBadge}>{label}</span>;
                    })}
                  </div>
                )}

                <div className={styles.cardFooter}>
                  <span className={`${styles.recruitment} ${p.recruitmentStatus === "OPEN" ? styles.recruitmentOpen : styles.recruitmentClosed}`}>
                    {p.recruitmentStatus === "OPEN" ? "Набор открыт" : "Набор закрыт"}
                  </span>
                  <span className={styles.slots}>
                    {p._count.projects}/{p.maxProjects} проектов
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
