"use client";

import { useState, useEffect, useCallback, use } from "react";
import styles from "./supervisor.module.css";

interface SupervisorProfile {
  id: string;
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
  recruitmentStatus: string;
  user: { name: string };
  projects: Array<{
    id: string;
    title: string;
    projectType: string;
    status: string;
    direction: string | null;
  }>;
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  CLASSIC_DISSERTATION: "Классическая диссертация",
  STARTUP: "Стартап",
  CORPORATE_STARTUP: "Корпоративный стартап",
};

export default function SupervisorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<SupervisorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const res = await fetch(`/api/supervisors/${id}`);
    if (res.ok) {
      setProfile(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) return <div className={styles.wrapper}><p>Загрузка...</p></div>;
  if (!profile) return <div className={styles.wrapper}><p>Профиль не найден</p></div>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <a href="/supervisors" className={styles.back}>← Каталог руководителей</a>

        {/* Шапка */}
        <div className={styles.header}>
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt="" className={styles.photo} />
          ) : (
            <div className={styles.photoPlaceholder}>
              {profile.user.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className={styles.name}>{profile.user.name}</h1>
            <p className={styles.meta}>{profile.academicDegree} · {profile.position}</p>
            <p className={styles.meta}>{profile.workplace}</p>
            <span className={`${styles.recruitment} ${profile.recruitmentStatus === "OPEN" ? styles.open : styles.closed}`}>
              {profile.recruitmentStatus === "OPEN" ? "Набор открыт" : "Набор закрыт"}
            </span>
          </div>
        </div>

        {/* Контент */}
        <div className={styles.grid}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Доменная экспертиза</h2>
            <div className={styles.tags}>
              {profile.expertise.map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Направления</h2>
            <div className={styles.tags}>
              {profile.directions.map((d) => (
                <span key={d} className={styles.tag}>{d}</span>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Готов работать с</h2>
            <ul className={styles.list}>
              {profile.workPreferences.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>

          {profile.proposedTopics && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Предлагаемые темы</h2>
              <p className={styles.text}>{profile.proposedTopics}</p>
            </div>
          )}

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Контакт</h2>
            <p className={styles.text}>{profile.contact}</p>
          </div>

          {profile.resumeUrl && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Резюме</h2>
              <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                Открыть файл
              </a>
            </div>
          )}

          {/* Проекты */}
          {profile.projects.length > 0 && (
            <div className={styles.sectionFull}>
              <h2 className={styles.sectionTitle}>Проекты</h2>
              <div className={styles.projects}>
                {profile.projects.map((proj) => (
                  <a key={proj.id} href={`/projects/${proj.id}`} className={styles.projectCard}>
                    <span className={styles.projectTitle}>{proj.title}</span>
                    <span className={styles.projectType}>{PROJECT_TYPE_LABELS[proj.projectType] || proj.projectType}</span>
                    {proj.direction && <span className={styles.projectDir}>{proj.direction}</span>}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
