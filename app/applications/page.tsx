"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "./applications.module.css";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "На рассмотрении",
  ACCEPTED: "Принята",
  REJECTED: "Отклонена",
};

interface StudentApplication {
  id: string;
  motivation: string;
  status: string;
  comment: string | null;
  createdAt: string;
  project: { id: string; title: string; status: string };
}

interface SupervisorApplication {
  id: string;
  motivation: string;
  status: string;
  comment: string | null;
  createdAt: string;
  project: { id: string; title: string };
  student: {
    id: string;
    direction: string;
    course: number;
    competencies: string[];
    portfolioUrl: string | null;
    contact: string;
    user: { name: string };
  };
}

export default function ApplicationsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [applications, setApplications] = useState<(StudentApplication | SupervisorApplication)[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");

  const fetchApps = useCallback(async () => {
    const res = await fetch("/api/applications");
    if (res.ok) setApplications(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  async function handleAction(id: string, action: "accept" | "reject") {
    const res = await fetch(`/api/applications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment }),
    });
    if (res.ok) {
      setMessage(action === "accept" ? "Заявка принята" : "Заявка отклонена");
      setActionId(null);
      setComment("");
      fetchApps();
    }
  }

  if (loading) return <div className={styles.wrapper}><p>Загрузка...</p></div>;

  // Вид для студента
  if (role === "STUDENT") {
    const apps = applications as StudentApplication[];
    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <h1 className={styles.title}>Мои заявки</h1>
          {apps.length === 0 ? (
            <p className={styles.empty}>Вы ещё не подавали заявок. <a href="/projects" className={styles.link}>Найти проект</a></p>
          ) : (
            <div className={styles.list}>
              {apps.map((app) => (
                <div key={app.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <a href={`/projects/${app.project.id}`} className={styles.projectLink}>{app.project.title}</a>
                    <span className={`${styles.status} ${styles[`status_${app.status}`]}`}>
                      {STATUS_LABELS[app.status]}
                    </span>
                  </div>
                  <p className={styles.motivation}>{app.motivation}</p>
                  {app.comment && <p className={styles.comment}>Комментарий: {app.comment}</p>}
                  <span className={styles.date}>{new Date(app.createdAt).toLocaleDateString("ru-RU")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Вид для НР
  const apps = applications as SupervisorApplication[];
  const pending = apps.filter((a) => a.status === "PENDING");
  const resolved = apps.filter((a) => a.status !== "PENDING");

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Заявки на мои проекты</h1>
        {message && <p className={styles.success}>{message}</p>}

        {pending.length > 0 && (
          <>
            <h2 className={styles.subtitle}>На рассмотрении ({pending.length})</h2>
            <div className={styles.list}>
              {pending.map((app) => (
                <div key={app.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.studentName}>{app.student.user.name}</span>
                    <span className={styles.projectBadge}>{app.project.title}</span>
                  </div>
                  <div className={styles.studentInfo}>
                    <span>{app.student.direction}, {app.student.course} курс</span>
                    {app.student.competencies.length > 0 && (
                      <div className={styles.tags}>
                        {app.student.competencies.slice(0, 5).map((c) => (
                          <span key={c} className={styles.tag}>{c}</span>
                        ))}
                      </div>
                    )}
                    {app.student.portfolioUrl && (
                      <a href={app.student.portfolioUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>Портфолио</a>
                    )}
                    <span className={styles.contact}>Контакт: {app.student.contact}</span>
                  </div>
                  <p className={styles.motivation}><strong>Мотивация:</strong> {app.motivation}</p>

                  {actionId === app.id ? (
                    <div className={styles.actionBlock}>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className={styles.textarea}
                        placeholder="Комментарий (обязателен при отклонении)"
                        rows={2}
                      />
                      <div className={styles.actionButtons}>
                        <button onClick={() => handleAction(app.id, "accept")} className={styles.acceptButton}>Принять</button>
                        <button onClick={() => handleAction(app.id, "reject")} className={styles.rejectButton}>Отклонить</button>
                        <button onClick={() => { setActionId(null); setComment(""); }} className={styles.cancelButton}>Отмена</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setActionId(app.id)} className={styles.reviewButton}>Рассмотреть</button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {resolved.length > 0 && (
          <>
            <h2 className={styles.subtitle}>Рассмотренные ({resolved.length})</h2>
            <div className={styles.list}>
              {resolved.map((app) => (
                <div key={app.id} className={`${styles.card} ${styles.cardResolved}`}>
                  <div className={styles.cardHeader}>
                    <span className={styles.studentName}>{app.student.user.name}</span>
                    <span className={`${styles.status} ${styles[`status_${app.status}`]}`}>
                      {STATUS_LABELS[app.status]}
                    </span>
                  </div>
                  <span className={styles.projectBadge}>{app.project.title}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {apps.length === 0 && <p className={styles.empty}>Заявок пока нет</p>}
      </div>
    </div>
  );
}
