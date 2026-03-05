"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import styles from "./project.module.css";

const TYPE_LABELS: Record<string, string> = {
  CLASSIC_DISSERTATION: "Классическая диссертация",
  STARTUP: "Стартап",
  CORPORATE_STARTUP: "Корпоративный стартап",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  OPEN: "Открыт",
  ACTIVE: "Активный",
  COMPLETED: "Завершён",
};

interface Project {
  id: string;
  title: string;
  description: string;
  projectType: string;
  status: string;
  direction: string | null;
  requiredRoles: string[];
  contact: string;
  assignmentStatus: string;
  createdAt: string;
  supervisor: {
    id: string;
    workplace: string;
    position: string;
    academicDegree: string;
    photoUrl: string | null;
    user: { name: string };
  } | null;
  members: Array<{
    id: string;
    role: string | null;
    student: {
      id: string;
      direction: string;
      course: number;
      contact: string;
      user: { name: string };
    };
  }>;
  files: Array<{ id: string; filename: string; filepath: string; uploadedAt: string }>;
  events: Array<{ id: string; title: string; date: string; eventType: string }>;
  _count: { applications: number };
}

interface ActivityItem {
  id: string;
  action: string;
  createdAt: string;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [motivation, setMotivation] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");
  const [applyErr, setApplyErr] = useState("");
  const [newEvent, setNewEvent] = useState({ title: "", date: "", eventType: "DEADLINE" });
  const [addingEvent, setAddingEvent] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) setProject(await res.json());
    setLoading(false);
  }, [id]);

  const fetchActivities = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/activities`);
    if (res.ok) setActivities(await res.json());
  }, [id]);

  useEffect(() => {
    fetchProject();
    fetchActivities();
  }, [fetchProject, fetchActivities]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/projects/${id}/files`, { method: "POST", body: fd });
      if (res.ok) {
        fetchProject();
        fetchActivities();
      } else {
        const data = await res.json();
        setUploadError(data.error || "Ошибка загрузки");
      }
    } catch {
      setUploadError("Ошибка сети");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleApply() {
    if (!motivation.trim()) { setApplyErr("Напишите мотивационное письмо"); return; }
    setApplying(true); setApplyErr(""); setApplyMsg("");
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, motivation }),
      });
      const data = await res.json();
      if (res.ok) { setApplyMsg("Заявка отправлена!"); setMotivation(""); }
      else setApplyErr(data.error || "Ошибка");
    } catch { setApplyErr("Ошибка сети"); }
    finally { setApplying(false); }
  }

  const canManage =
    session?.user?.role === "ADMIN" ||
    (session?.user?.role === "SUPERVISOR" && project?.supervisor?.user?.name === session?.user?.name);

  async function handleAssignment(action: "confirm" | "decline") {
    setAssignmentLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/assignment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) fetchProject();
    } catch { /* ignore */ }
    finally { setAssignmentLoading(false); }
  }

  async function handleAddEvent() {
    if (!newEvent.title || !newEvent.date) return;
    setAddingEvent(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newEvent, projectId: id }),
      });
      if (res.ok) {
        setNewEvent({ title: "", date: "", eventType: "DEADLINE" });
        fetchProject();
      }
    } catch { /* ignore */ }
    finally { setAddingEvent(false); }
  }

  if (loading) return <div className={styles.wrapper}><p>Загрузка...</p></div>;
  if (!project) return <div className={styles.wrapper}><p>Проект не найден</p></div>;

  // Незакрытые роли: требуемые минус уже занятые
  const filledRoles = project.members.map((m) => m.role).filter(Boolean);
  const openRoles = project.requiredRoles.filter((r) => !filledRoles.includes(r));

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <a href="/projects" className={styles.back}>← Каталог проектов</a>

        {/* 03.01 — Информационный блок */}
        <div className={styles.header}>
          <h1 className={styles.title}>{project.title}</h1>
          <div className={styles.badges}>
            <span className={styles.typeBadge}>{TYPE_LABELS[project.projectType]}</span>
            <span className={`${styles.statusBadge} ${styles[`status_${project.status}`]}`}>
              {STATUS_LABELS[project.status]}
            </span>
            {project.direction && <span className={styles.dirBadge}>{project.direction}</span>}
          </div>
        </div>

        <div className={styles.grid}>
          {/* Описание */}
          <div className={styles.sectionFull}>
            <h2 className={styles.sectionTitle}>Описание</h2>
            <p className={styles.text}>{project.description}</p>
          </div>

          {/* 03.02 — Блок руководителя (мини-карточка) */}
          {project.supervisor && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Научный руководитель</h2>
              <a href={`/supervisors/${project.supervisor.id}`} className={styles.supervisorCard}>
                {project.supervisor.photoUrl ? (
                  <img src={project.supervisor.photoUrl} alt="" className={styles.supervisorPhoto} />
                ) : (
                  <div className={styles.supervisorPhotoPlaceholder}>
                    {project.supervisor.user.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className={styles.supervisorName}>{project.supervisor.user.name}</div>
                  <div className={styles.supervisorMeta}>{project.supervisor.academicDegree}</div>
                  <div className={styles.supervisorMeta}>{project.supervisor.position}, {project.supervisor.workplace}</div>
                </div>
              </a>
            </div>
          )}

          {/* 04.03 — Подтверждение назначения НР */}
          {project.assignmentStatus === "PENDING_SUPERVISOR" && session?.user?.role === "SUPERVISOR" && canManage && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Подтверждение назначения</h2>
              <p className={styles.text}>Вам предложено руководство этим проектом. Подтвердите или отклоните.</p>
              <div className={styles.assignmentActions}>
                <button
                  onClick={() => handleAssignment("confirm")}
                  className={styles.confirmBtn}
                  disabled={assignmentLoading}
                >
                  Подтвердить
                </button>
                <button
                  onClick={() => handleAssignment("decline")}
                  className={styles.declineBtn}
                  disabled={assignmentLoading}
                >
                  Отклонить
                </button>
              </div>
            </div>
          )}

          {/* Контакт */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Контакт для связи</h2>
            <p className={styles.text}>{project.contact}</p>
          </div>

          {/* Незакрытые роли */}
          {openRoles.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Ищем в команду</h2>
              <div className={styles.tags}>
                {openRoles.map((r) => (
                  <span key={r} className={styles.openRoleTag}>{r}</span>
                ))}
              </div>
            </div>
          )}

          {/* Все требуемые роли */}
          {project.requiredRoles.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Все требуемые роли</h2>
              <div className={styles.tags}>
                {project.requiredRoles.map((r) => {
                  const filled = filledRoles.includes(r);
                  return (
                    <span key={r} className={filled ? styles.filledRoleTag : styles.tag}>
                      {r} {filled && "✓"}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 03.03 — Блок студентов (участники) */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Участники команды ({project.members.length})</h2>
            {project.members.length === 0 ? (
              <p className={styles.muted}>Пока нет участников</p>
            ) : (
              <div className={styles.memberCards}>
                {project.members.map((m) => (
                  <div key={m.id} className={styles.memberCard}>
                    <div className={styles.memberName}>{m.student.user.name}</div>
                    <div className={styles.memberMeta}>
                      {m.student.direction}, {m.student.course} курс
                    </div>
                    {m.role && <span className={styles.memberRoleBadge}>{m.role}</span>}
                    <div className={styles.memberContact}>{m.student.contact}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 03.04 — Файлы и материалы */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Файлы и материалы</h2>
            {project.files.length === 0 && !uploading && (
              <p className={styles.muted}>Файлы не загружены</p>
            )}
            {project.files.length > 0 && (
              <ul className={styles.fileList}>
                {project.files.map((f) => (
                  <li key={f.id} className={styles.fileItem}>
                    <a href={f.filepath} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                      {f.filename}
                    </a>
                    <span className={styles.fileDate}>
                      {new Date(f.uploadedAt).toLocaleDateString("ru-RU")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <label className={styles.uploadButton}>
              {uploading ? "Загрузка..." : "Загрузить файл"}
              <input type="file" onChange={handleFileUpload} hidden disabled={uploading} />
            </label>
            {uploadError && <p className={styles.error}>{uploadError}</p>}
          </div>

          {/* 03.05 — Таймлайн / дедлайны (06.03, 06.05) */}
          <div className={styles.sectionFull}>
            <h2 className={styles.sectionTitle}>Дедлайны и события</h2>
            {project.events && project.events.length > 0 ? (
              <div className={styles.timeline}>
                {project.events
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((ev) => (
                    <div key={ev.id} className={styles.timelineItem}>
                      <span className={styles.timelineDate}>
                        {new Date(ev.date).toLocaleDateString("ru-RU")}
                      </span>
                      <span className={`${styles.timelineBadge} ${styles[`badge_${ev.eventType}`] || ""}`}>
                        {ev.eventType === "DEADLINE" ? "Дедлайн" : ev.eventType === "DEFENSE" ? "Защита" : ev.eventType === "CONSULTATION" ? "Консультация" : "Другое"}
                      </span>
                      <span className={styles.timelineTitle}>{ev.title}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className={styles.muted}>Нет событий</p>
            )}

            {canManage && (
              <div className={styles.addEventRow}>
                <input
                  placeholder="Название"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                />
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                />
                <select
                  value={newEvent.eventType}
                  onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                >
                  <option value="DEADLINE">Дедлайн</option>
                  <option value="DEFENSE">Защита</option>
                  <option value="CONSULTATION">Консультация</option>
                  <option value="OTHER">Другое</option>
                </select>
                <button onClick={handleAddEvent} className={styles.addEventBtn} disabled={addingEvent}>
                  + Событие
                </button>
              </div>
            )}
          </div>

          {/* 03.06 — Лента активности */}
          {activities.length > 0 && (
            <div className={styles.sectionFull}>
              <h2 className={styles.sectionTitle}>Лента активности</h2>
              <div className={styles.activityList}>
                {activities.map((a) => (
                  <div key={a.id} className={styles.activityItem}>
                    <span className={styles.activityDate}>
                      {new Date(a.createdAt).toLocaleDateString("ru-RU", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <span className={styles.activityAction}>{a.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Блок подачи заявки (05.01) — только для студентов, только открытые проекты */}
        {session?.user?.role === "STUDENT" && project.status === "OPEN" && (
          <div className={styles.applyBlock}>
            <h2 className={styles.sectionTitle}>Подать заявку</h2>
            {applyMsg ? (
              <p className={styles.applySuccess}>{applyMsg}</p>
            ) : (
              <>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  className={styles.applyTextarea}
                  rows={4}
                  placeholder="Расскажите, почему хотите участвовать в этом проекте..."
                />
                {applyErr && <p className={styles.error}>{applyErr}</p>}
                <button onClick={handleApply} className={styles.applyButton} disabled={applying}>
                  {applying ? "Отправка..." : "Отправить заявку"}
                </button>
              </>
            )}
          </div>
        )}

        <div className={styles.meta}>
          Создан {new Date(project.createdAt).toLocaleDateString("ru-RU")} · {project._count.applications} заявок
        </div>
      </div>
    </div>
  );
}
