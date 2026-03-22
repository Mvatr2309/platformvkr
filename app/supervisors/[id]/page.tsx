"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
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
  projectTypes: string[];
  user: { name: string };
  projects: Array<{
    id: string;
    title: string;
    projectType: string;
    status: string;
    direction: string | null;
  }>;
}

interface MyProject {
  id: string;
  title: string;
  projectType: string;
  supervisorId: string | null;
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  CLASSIC_DISSERTATION: "Исследование",
  STARTUP: "Стартап",
  CORPORATE_STARTUP: "Корпоративный стартап",
};

export default function SupervisorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [profile, setProfile] = useState<SupervisorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Форма предложения проекта
  const [myProjects, setMyProjects] = useState<MyProject[]>([]);
  const [showPropose, setShowPropose] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [proposeMsg, setProposeMsg] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposeSuccess, setProposeSuccess] = useState("");
  const [proposeErr, setProposeErr] = useState("");

  const fetchProfile = useCallback(async () => {
    const res = await fetch(`/api/supervisors/${id}`);
    if (res.ok) {
      setProfile(await res.json());
    }
    setLoading(false);
  }, [id]);

  // Загрузить мои проекты (где я автор и нет НР)
  const fetchMyProjects = useCallback(async () => {
    if (!session?.user || session.user.role !== "STUDENT") return;
    try {
      const res = await fetch("/api/projects?my=true");
      if (res.ok) {
        const projects = await res.json();
        // Фильтруем: только те где нет supervisorId
        setMyProjects(projects.filter((p: MyProject) => !p.supervisorId));
      }
    } catch { /* ignore */ }
  }, [session]);

  useEffect(() => {
    fetchProfile();
    fetchMyProjects();
  }, [fetchProfile, fetchMyProjects]);

  async function handlePropose() {
    if (!selectedProject) { setProposeErr("Выберите проект"); return; }
    if (!proposeMsg.trim()) { setProposeErr("Напишите сообщение руководителю"); return; }
    setProposing(true); setProposeErr(""); setProposeSuccess("");
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SUPERVISION_REQUEST",
          projectId: selectedProject,
          supervisorId: id,
          motivation: proposeMsg,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setProposeSuccess("Предложение отправлено!");
        setSelectedProject("");
        setProposeMsg("");
        setShowPropose(false);
      } else {
        setProposeErr(data.error || "Ошибка");
      }
    } catch { setProposeErr("Ошибка сети"); }
    finally { setProposing(false); }
  }

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
            {profile.projectTypes && profile.projectTypes.length > 0 && (
              <div className={styles.projectTypes}>
                <span className={styles.projectTypesLabel}>Работает с:</span>
                {profile.projectTypes.map((t) => (
                  <span key={t} className={styles.projectTypeBadge}>
                    {PROJECT_TYPE_LABELS[t] || t}
                  </span>
                ))}
              </div>
            )}
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

        {/* Блок предложения проекта — только для студентов */}
        {session?.user?.role === "STUDENT" && profile.recruitmentStatus === "OPEN" && (
          <div className={styles.proposeBlock}>
            {proposeSuccess ? (
              <p className={styles.proposeSuccess}>{proposeSuccess}</p>
            ) : !showPropose ? (
              <button
                onClick={() => setShowPropose(true)}
                className={styles.proposeButton}
                disabled={myProjects.length === 0}
              >
                {myProjects.length === 0
                  ? "Нет проектов без руководителя"
                  : "Предложить свой проект"}
              </button>
            ) : (
              <div className={styles.proposeForm}>
                <h2 className={styles.sectionTitle}>Предложить проект</h2>
                <p className={styles.proposeHint}>
                  Выберите свой проект и напишите, почему хотите работать с этим руководителем.
                  Если НР заинтересуется — вам раскроются контакты для встречи.
                </p>

                <div className={styles.proposeField}>
                  <label className={styles.proposeLabel}>Проект</label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className={styles.proposeSelect}
                  >
                    <option value="">Выберите проект...</option>
                    {myProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({PROJECT_TYPE_LABELS[p.projectType] || p.projectType})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.proposeField}>
                  <label className={styles.proposeLabel}>Сообщение руководителю</label>
                  <textarea
                    value={proposeMsg}
                    onChange={(e) => setProposeMsg(e.target.value)}
                    className={styles.proposeTextarea}
                    rows={4}
                    placeholder="Расскажите, почему хотите работать с этим руководителем, какая тема вашего проекта..."
                  />
                </div>

                {proposeErr && <p className={styles.proposeError}>{proposeErr}</p>}

                <div className={styles.proposeActions}>
                  <button onClick={handlePropose} className={styles.proposeSubmit} disabled={proposing}>
                    {proposing ? "Отправка..." : "Отправить предложение"}
                  </button>
                  <button onClick={() => { setShowPropose(false); setProposeErr(""); }} className={styles.proposeCancel}>
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
