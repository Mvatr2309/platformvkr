"use client";

import { useState, useEffect, useCallback } from "react";
import { useDictionary } from "@/lib/useDictionary";
import Pagination, { usePagination } from "@/components/Pagination";
import styles from "./projects.module.css";

const PROJECT_TYPES = [
  { value: "CLASSIC_DISSERTATION", label: "Исследование" },
  { value: "STARTUP", label: "Стартап" },
  { value: "CORPORATE_STARTUP", label: "Корпоративный стартап" },
];

const TYPE_LABELS: Record<string, string> = {
  CLASSIC_DISSERTATION: "Исследование",
  STARTUP: "Стартап",
  CORPORATE_STARTUP: "Корпоративный стартап",
};

interface ProjectCard {
  id: string;
  title: string;
  description: string;
  projectType: string;
  status: string;
  direction: string | null;
  requiredRoles: string[];
  updatedAt: string;
  supervisor: { id: string; user: { name: string } } | null;
  _count: { members: number; applications: number };
}

export default function ProjectsPage() {
  const DIRECTIONS = useDictionary("directions");
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [search, setSearch] = useState("");
  const [projectType, setProjectType] = useState("");
  const [direction, setDirection] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (projectType) params.set("projectType", projectType);
    if (direction) params.set("direction", direction);

    const res = await fetch(`/api/projects?${params}`);
    if (res.ok) setProjects(await res.json());
    setLoading(false);
  }, [search, projectType, direction]);

  useEffect(() => {
    const timer = setTimeout(fetchProjects, 300);
    return () => clearTimeout(timer);
  }, [fetchProjects]);

  const hasFilters = search || projectType || direction;

  const { page, setPage, totalPages, paged } = usePagination(projects, 20);

  useEffect(() => {
    setPage(1);
  }, [search, projectType, direction]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Проекты</h1>
          <a href="/projects/new" className={styles.createButton}>Создать проект</a>
        </div>

        <div className={styles.filters}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            placeholder="Поиск по названию и описанию..."
          />
          <div className={styles.filterRow}>
            <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={styles.select}>
              <option value="">Все типы</option>
              {PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={direction} onChange={(e) => setDirection(e.target.value)} className={styles.select}>
              <option value="">Все магистратуры</option>
              {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {hasFilters && (
              <button onClick={() => { setSearch(""); setProjectType(""); setDirection(""); }} className={styles.clearButton}>
                Сбросить
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className={styles.empty}>Загрузка...</p>
        ) : projects.length === 0 ? (
          <p className={styles.empty}>
            {hasFilters ? "Ничего не найдено." : "Пока нет открытых проектов."}
          </p>
        ) : (
          <>
          <div className={styles.list}>
            {paged.map((p) => (
              <a key={p.id} href={`/projects/${p.id}`} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>{p.title}</span>
                  <span className={styles.typeBadge}>{TYPE_LABELS[p.projectType]}</span>
                </div>
                <p className={styles.cardDesc}>
                  {p.description.length > 200 ? p.description.slice(0, 200) + "..." : p.description}
                </p>
                <div className={styles.cardFooter}>
                  {p.supervisor
                    ? <span className={styles.supervisor}>Науч. рук.: {p.supervisor.user.name}</span>
                    : <span className={styles.needsSupervisor}>Ищет научного руководителя</span>
                  }
                  {p.direction && <span className={styles.dirBadge}>{p.direction}</span>}
                  {p.projectType !== "CLASSIC_DISSERTATION" && p.requiredRoles.length > 0 && (
                    <span className={styles.roles}>{p.requiredRoles.join(", ")}</span>
                  )}
                  {p.projectType !== "CLASSIC_DISSERTATION" ? (
                    <span className={styles.stats}>
                      {p._count.members} участн. · {p._count.applications} заявок
                    </span>
                  ) : (
                    <span className={styles.stats}>1 на 1 с научным руководителем</span>
                  )}
                </div>
              </a>
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
