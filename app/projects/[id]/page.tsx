"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import styles from "./project.module.css";

const TYPE_LABELS: Record<string, string> = {
  CLASSIC_DISSERTATION: "Исследование",
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
    userId: string;
    workplace: string;
    position: string;
    academicDegree: string;
    photoUrl: string | null;
    user: { name: string };
  } | null;
  members: Array<{
    id: string;
    role: string | null;
    isCreator: boolean;
    student: {
      id: string;
      userId: string;
      direction: string;
      course: number;
      contact: string;
      user: { name: string; email: string };
    };
  }>;
  files: Array<{ id: string; title: string; fileType: string; filename: string | null; filepath: string | null; url: string | null; uploadedAt: string }>;
  events: Array<{ id: string; title: string; date: string; eventType: string }>;
  _count: { applications: number };
}

interface ActivityItem {
  id: string;
  action: string;
  actorEmail: string | null;
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
  const [showAddFile, setShowAddFile] = useState(false);
  const [newFileTitle, setNewFileTitle] = useState("");
  const [newFileType, setNewFileType] = useState<"FILE" | "LINK">("FILE");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [deletingFileId, setDeletingFileId] = useState("");
  const [motivation, setMotivation] = useState("");
  const [applyRole, setApplyRole] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");
  const [applyErr, setApplyErr] = useState("");
  const [myApplication, setMyApplication] = useState<{ status: string } | null>(null);
  const [mySupervisorApp, setMySupervisorApp] = useState<{ status: string } | null>(null);
  const [newEvent, setNewEvent] = useState({ title: "", date: "", eventType: "DEADLINE" });
  const [addingEvent, setAddingEvent] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) setProject(await res.json());
    setLoading(false);
  }, [id]);

  const fetchActivities = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/activities`);
    if (res.ok) setActivities(await res.json());
  }, [id]);

  const checkMyApplication = useCallback(async () => {
    if (!session?.user) return;
    if (session.user.role === "STUDENT") {
      try {
        const res = await fetch("/api/applications");
        if (res.ok) {
          const apps = await res.json();
          const found = apps.find((a: { project: { id: string }; status: string }) => a.project.id === id);
          if (found) setMyApplication({ status: found.status });
        }
      } catch { /* ignore */ }
    }
    if (session.user.role === "SUPERVISOR") {
      try {
        const res = await fetch("/api/applications?as=my");
        if (res.ok) {
          const apps = await res.json();
          const found = apps.find((a: { project: { id: string }; status: string }) => a.project.id === id);
          if (found) setMySupervisorApp({ status: found.status });
        }
      } catch { /* ignore */ }
    }
  }, [session, id]);

  useEffect(() => {
    fetchProject();
    fetchActivities();
    checkMyApplication();
  }, [fetchProject, fetchActivities, checkMyApplication]);

  async function handleAddFileSlot(file?: File) {
    if (!newFileTitle.trim()) {
      setUploadError("Укажите название документа");
      return;
    }
    setUploading(true);
    setUploadError("");

    try {
      const fd = new FormData();
      fd.append("title", newFileTitle.trim());
      fd.append("fileType", newFileType);

      if (newFileType === "LINK") {
        if (!newFileUrl.trim()) {
          setUploadError("Укажите ссылку");
          setUploading(false);
          return;
        }
        fd.append("url", newFileUrl.trim());
      } else {
        if (!file) {
          setUploadError("Выберите файл");
          setUploading(false);
          return;
        }
        fd.append("file", file);
      }

      const res = await fetch(`/api/projects/${id}/files`, { method: "POST", body: fd });
      if (res.ok) {
        fetchProject();
        fetchActivities();
        setShowAddFile(false);
        setNewFileTitle("");
        setNewFileType("FILE");
        setNewFileUrl("");
      } else {
        const data = await res.json();
        setUploadError(data.error || "Ошибка");
      }
    } catch {
      setUploadError("Ошибка сети");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm("Удалить этот документ?")) return;
    setDeletingFileId(fileId);
    try {
      const res = await fetch(`/api/projects/${id}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      if (res.ok) {
        fetchProject();
        fetchActivities();
      }
    } catch { /* ignore */ } finally {
      setDeletingFileId("");
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!confirm(`Удалить ${memberName} из команды?`)) return;
    setRemovingMemberId(memberId);
    try {
      const res = await fetch(`/api/projects/${id}/members/${memberId}`, { method: "DELETE" });
      if (res.ok) {
        fetchProject();
        fetchActivities();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка удаления");
      }
    } catch { alert("Ошибка сети"); }
    finally { setRemovingMemberId(null); }
  }

  async function handleApply() {
    if (!motivation.trim()) { setApplyErr("Напишите мотивационное письмо"); return; }
    setApplying(true); setApplyErr(""); setApplyMsg("");
    try {
      const body: Record<string, string> = { projectId: id, motivation };
      if (applyRole) body.role = applyRole;
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) { setApplyMsg("Заявка отправлена!"); setMotivation(""); checkMyApplication(); }
      else setApplyErr(data.error || "Ошибка");
    } catch { setApplyErr("Ошибка сети"); }
    finally { setApplying(false); }
  }

  const userId = session?.user?.id;
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";
  const isSupervisorOwner = userRole === "SUPERVISOR" && project?.supervisor?.userId === userId;
  const isMember = project?.members.some((m) => m.student.user.name === session?.user?.name);
  const isAuthor = project?.members.some((m) => m.isCreator && m.student.user.name === session?.user?.name);
  const canEdit = isAdmin || isAuthor;
  const canManage = isAdmin || isAuthor || isSupervisorOwner || isMember;
  const otherMembers = project?.members.filter((m) => !m.isCreator) || [];
  const canDelete = isAdmin || (isAuthor && otherMembers.length === 0);

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ title: "", description: "", contact: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmitForModeration() {
    if (!confirm("Отправить проект на модерацию?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit: true }),
      });
      if (res.ok) fetchProject();
      else {
        const data = await res.json();
        alert(data.error || "Ошибка");
      }
    } catch { alert("Ошибка сети"); }
    finally { setSubmitting(false); }
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        setEditing(false);
        fetchProject();
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm("Вы уверены, что хотите удалить этот проект?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/my-projects";
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка удаления");
      }
    } catch { alert("Ошибка сети"); }
    finally { setDeleting(false); }
  }

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
  const isResearch = project.projectType === "CLASSIC_DISSERTATION";
  const isStartup = ["STARTUP", "CORPORATE_STARTUP"].includes(project.projectType);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <a href="/projects" className={styles.back}>← Каталог проектов</a>

        {/* 03.01 — Информационный блок */}
        <div className={styles.header}>
          <div className={styles.headerRow}>
            {editing ? (
              <input
                type="text"
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className={styles.editInput}
                style={{ fontSize: 24, fontWeight: 800, flex: 1 }}
              />
            ) : (
              <h1 className={styles.title}>{project.title}</h1>
            )}
            {canEdit && (
              <div className={styles.headerActions}>
                {project.status === "DRAFT" && (isAuthor || isAdmin) && !editing && (
                  <button onClick={handleSubmitForModeration} className={styles.editBtn} disabled={submitting} style={{ background: "#003092", color: "#fff" }}>
                    {submitting ? "Отправка..." : "Отправить на модерацию"}
                  </button>
                )}
                {!editing && (
                  <button
                    onClick={() => { setEditing(true); setEditData({ title: project.title, description: project.description, contact: project.contact }); }}
                    className={styles.editBtn}
                  >
                    Редактировать
                  </button>
                )}
                {canDelete && !editing && (
                  <button onClick={handleDelete} className={styles.deleteBtn} disabled={deleting}>
                    {deleting ? "Удаление..." : "Удалить"}
                  </button>
                )}
              </div>
            )}
          </div>
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
            {editing ? (
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className={styles.editTextarea}
                rows={6}
              />
            ) : (
              <p className={styles.text}>{project.description}</p>
            )}
          </div>

          {/* 03.02 — Блок руководителя */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Научный руководитель</h2>
            {project.supervisor ? (
              <div>
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
                {isAdmin && (
                  <button
                    className={styles.deleteBtn}
                    style={{ marginTop: 8, fontSize: 13 }}
                    onClick={async () => {
                      if (!confirm("Снять научного руководителя с проекта?")) return;
                      const res = await fetch(`/api/projects/${id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ removeSupervisor: true }),
                      });
                      if (res.ok) fetchProject();
                      else alert("Ошибка");
                    }}
                  >
                    Снять руководителя
                  </button>
                )}
                {isSupervisorOwner && !isAdmin && (
                  <button
                    className={styles.deleteBtn}
                    style={{ marginTop: 8, fontSize: 13 }}
                    onClick={async () => {
                      if (!confirm("Вы уверены, что хотите покинуть этот проект?")) return;
                      const res = await fetch(`/api/projects/${id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ leaveSupervisor: true }),
                      });
                      if (res.ok) {
                        fetchProject();
                        fetchActivities();
                      } else {
                        const data = await res.json();
                        alert(data.error || "Ошибка");
                      }
                    }}
                  >
                    Покинуть проект
                  </button>
                )}
              </div>
            ) : (
              <p className={styles.muted}>Не назначен</p>
            )}
          </div>

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
            {editing ? (
              <input
                type="text"
                value={editData.contact}
                onChange={(e) => setEditData({ ...editData, contact: e.target.value })}
                className={styles.editInput}
              />
            ) : (
              <p className={styles.text}>{project.contact}</p>
            )}
          </div>

          {/* Требуемые роли — только для стартапов */}
          {!isResearch && project.requiredRoles.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Роли в команде</h2>
              <div className={styles.tags}>
                {project.requiredRoles.map((r) => {
                  const filled = filledRoles.includes(r);
                  return (
                    <span key={r} className={filled ? styles.filledRoleTag : styles.openRoleTag}>
                      {filled ? `${r} — занята` : `${r} — ищем`}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 03.03 — Блок студентов (участники) — для исследований показываем «Студент» */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>{isResearch ? "Студент" : `Участники команды (${project.members.length})`}</h2>
            {project.members.length === 0 ? (
              <p className={styles.muted}>Пока нет участников</p>
            ) : (
              <div className={styles.memberCards}>
                {project.members.map((m) => {
                  const isSelf = m.student.userId === userId;
                  // Кто может удалить этого участника:
                  const canRemove =
                    (isAdmin) || // Админ — всех
                    (isAuthor && !isSelf) || // Автор — всех кроме себя
                    (isSupervisorOwner && !m.isCreator) || // НР — всех кроме автора
                    (isSelf && !m.isCreator); // Сам себя, если не автор

                  return (
                    <div key={m.id} className={styles.memberCard}>
                      <div className={styles.memberCardHeader}>
                        <div className={styles.memberName}>{m.student.user.name}</div>
                        {canRemove && (
                          <button
                            onClick={() => handleRemoveMember(m.id, m.student.user.name)}
                            className={styles.removeMemberBtn}
                            disabled={removingMemberId === m.id}
                            title={isSelf ? "Покинуть проект" : "Удалить из команды"}
                          >
                            {removingMemberId === m.id ? "..." : "×"}
                          </button>
                        )}
                      </div>
                      <div className={styles.memberMeta}>
                        {m.student.direction}, {m.student.course} курс
                      </div>
                      <div className={styles.memberBadges}>
                        {m.isCreator && <span className={styles.creatorBadge}>Автор</span>}
                        {m.role && <span className={styles.memberRoleBadge}>{m.role}</span>}
                      </div>
                      <div className={styles.memberContact}>{m.student.contact}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 03.04 — Файлы и материалы */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Файлы и материалы</h2>
            {project.files.length === 0 && !showAddFile && (
              <p className={styles.muted}>Документы не добавлены</p>
            )}
            {project.files.length > 0 && (
              <div className={styles.fileSlots}>
                {project.files.map((f) => (
                  <div key={f.id} className={styles.fileSlot}>
                    <div className={styles.fileSlotInfo}>
                      <span className={styles.fileSlotTitle}>{f.title}</span>
                      <span className={styles.fileSlotType}>
                        {f.fileType === "LINK" ? "Ссылка" : f.filename || "Файл"}
                      </span>
                    </div>
                    <div className={styles.fileSlotActions}>
                      {f.fileType === "LINK" && f.url ? (
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                          Открыть
                        </a>
                      ) : f.filepath ? (
                        <a href={f.filepath} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                          Скачать
                        </a>
                      ) : null}
                      {session?.user && (
                        <button
                          className={styles.fileDeleteBtn}
                          onClick={() => handleDeleteFile(f.id)}
                          disabled={deletingFileId === f.id}
                        >
                          {deletingFileId === f.id ? "..." : "×"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {session?.user && !showAddFile && (
              <button className={styles.uploadButton} onClick={() => setShowAddFile(true)}>
                Добавить документ
              </button>
            )}

            {showAddFile && (
              <div className={styles.addFileForm}>
                <input
                  type="text"
                  value={newFileTitle}
                  onChange={(e) => setNewFileTitle(e.target.value)}
                  className={styles.addFileInput}
                  placeholder="Название документа (напр. Концепция исследования)"
                />
                <div className={styles.addFileTypeToggle}>
                  <button
                    type="button"
                    className={`${styles.addFileTypeBtn} ${newFileType === "FILE" ? styles.addFileTypeBtnActive : ""}`}
                    onClick={() => setNewFileType("FILE")}
                  >
                    Загрузить файл
                  </button>
                  <button
                    type="button"
                    className={`${styles.addFileTypeBtn} ${newFileType === "LINK" ? styles.addFileTypeBtnActive : ""}`}
                    onClick={() => setNewFileType("LINK")}
                  >
                    Вставить ссылку
                  </button>
                </div>

                {newFileType === "LINK" ? (
                  <input
                    type="url"
                    value={newFileUrl}
                    onChange={(e) => setNewFileUrl(e.target.value)}
                    className={styles.addFileInput}
                    placeholder="https://drive.google.com/..."
                  />
                ) : (
                  <label className={styles.addFilePickBtn}>
                    Выбрать файл
                    <input
                      type="file"
                      hidden
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAddFileSlot(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}

                <div className={styles.addFileActions}>
                  {newFileType === "LINK" && (
                    <button
                      className={styles.addFileSaveBtn}
                      onClick={() => handleAddFileSlot()}
                      disabled={uploading}
                    >
                      {uploading ? "Сохранение..." : "Сохранить"}
                    </button>
                  )}
                  <button
                    className={styles.addFileCancelBtn}
                    onClick={() => { setShowAddFile(false); setUploadError(""); setNewFileTitle(""); setNewFileUrl(""); }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
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
                    {a.actorEmail && <span className={styles.activityActor}>{a.actorEmail}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Кнопки inline-редактирования */}
          {editing && (
            <div className={styles.sectionFull}>
              <div className={styles.editActions}>
                <button onClick={handleSaveEdit} className={styles.confirmBtn} disabled={saving}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
                <button onClick={() => setEditing(false)} className={styles.declineBtn}>Отмена</button>
              </div>
            </div>
          )}
        </div>

        {/* Блок подачи заявки (05.01) — только для студентов, только открытые проекты */}
        {session?.user?.role === "STUDENT" && project.status === "OPEN" && !isMember && !isResearch && (
          <div className={styles.applyBlock}>
            {myApplication ? (
              <>
                <h2 className={styles.sectionTitle}>Ваша заявка</h2>
                <p className={styles.applySuccess}>
                  {myApplication.status === "PENDING" && "Заявка ожидает рассмотрения"}
                  {myApplication.status === "ACCEPTED" && "Заявка принята!"}
                  {myApplication.status === "REJECTED" && "Заявка отклонена"}
                  {myApplication.status === "APPROVED_BY_AUTHOR" && "Заявка одобрена автором, ожидает подтверждения"}
                </p>
              </>
            ) : applyMsg ? (
              <p className={styles.applySuccess}>{applyMsg}</p>
            ) : (
              <>
                <h2 className={styles.sectionTitle}>Подать заявку</h2>
                {(() => {
                  const author = project.members.find((m) => m.isCreator);
                  if (author) {
                    return (
                      <div className={styles.authorContact} style={{ marginBottom: 16, padding: "12px 16px", background: "#f5f7fa", borderLeft: "3px solid #003092" }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Автор проекта: {author.student.user.name}</div>
                        <div style={{ fontSize: 14, color: "#555" }}>
                          Email: {author.student.user.email}
                          {author.student.contact && <> · Контакт: {author.student.contact}</>}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                {project.requiredRoles.length > 0 && (
                  <div className={styles.applyField}>
                    <label className={styles.applyLabel}>Желаемая роль</label>
                    <select
                      value={applyRole}
                      onChange={(e) => setApplyRole(e.target.value)}
                      className={styles.applySelect}
                    >
                      <option value="">Выберите роль...</option>
                      {openRoles.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}
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

        {/* Блок заявки НР на руководство — только если проект открыт и без НР */}
        {session?.user?.role === "SUPERVISOR" && project.status === "OPEN" && !project.supervisor && !isSupervisorOwner && (
          <div className={styles.applyBlock}>
            {mySupervisorApp ? (
              <>
                <h2 className={styles.sectionTitle}>Ваша заявка на руководство</h2>
                <p className={styles.applySuccess}>
                  {mySupervisorApp.status === "PENDING" && "Заявка ожидает рассмотрения"}
                  {mySupervisorApp.status === "ACCEPTED" && "Вы назначены руководителем!"}
                  {mySupervisorApp.status === "REJECTED" && "Заявка отклонена"}
                </p>
              </>
            ) : applyMsg ? (
              <p className={styles.applySuccess}>{applyMsg}</p>
            ) : (
              <>
                <h2 className={styles.sectionTitle}>Стать руководителем</h2>
                <p className={styles.text} style={{ marginBottom: 12 }}>
                  У этого проекта пока нет научного руководителя. Вы можете подать заявку на руководство.
                </p>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  className={styles.applyTextarea}
                  rows={4}
                  placeholder="Расскажите, почему вы хотите руководить этим проектом, какой опыт можете предложить..."
                />
                {applyErr && <p className={styles.error}>{applyErr}</p>}
                <button onClick={handleApply} className={styles.applyButton} disabled={applying}>
                  {applying ? "Отправка..." : "Подать заявку на руководство"}
                </button>
              </>
            )}
          </div>
        )}

        <div className={styles.meta}>
          Создан {new Date(project.createdAt).toLocaleDateString("ru-RU")}{!isResearch && ` · ${project._count.applications} заявок`}
        </div>
      </div>
    </div>
  );
}
