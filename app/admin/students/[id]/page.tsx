"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import styles from "./detail.module.css";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  OPEN: "Открыт",
  ACTIVE: "Активный",
  COMPLETED: "Завершён",
};

interface Teammate {
  userId: string | null;
  name: string;
  email: string | null;
  role: string;
  inSystem: boolean;
}

interface StudentProject {
  id: string;
  title: string;
  status: string;
  supervisorName: string | null;
  role: string;
  joinedAt: string;
  teammates: Teammate[];
}

interface StudentDetail {
  id: string;
  name: string;
  email: string;
  profileCompleted: boolean;
  createdAt: string;
  profile: {
    direction: string;
    course: number | null;
    cohort: string | null;
    about: string | null;
    competencies: string[];
    desiredRoles: string[];
    portfolioUrl: string | null;
    contact: string | null;
  } | null;
  projects: StudentProject[];
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStudent = useCallback(async () => {
    const res = await fetch(`/api/admin/students/${id}`);
    if (res.ok) {
      setStudent(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  if (loading) return <p>Загрузка...</p>;
  if (!student) return <p>Студент не найден</p>;

  return (
    <div>
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); router.back(); }}
        className={styles.back}
      >
        ← Назад
      </a>

      <div className={styles.header}>
        <h1 className={styles.name}>{student.name || "Без имени"}</h1>
        <p className={styles.email}>{student.email}</p>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Основная информация</h3>
          {student.profile ? (
            <dl className={styles.dl}>
              <dt>Магистратура</dt>
              <dd>{student.profile.direction || "—"}</dd>
              <dt>Курс</dt>
              <dd>{student.profile.course ?? "—"}</dd>
              <dt>Когорта</dt>
              <dd>{student.profile.cohort || "—"}</dd>
              <dt>Контакт</dt>
              <dd>{student.profile.contact || "—"}</dd>
              <dt>Портфолио</dt>
              <dd>
                {student.profile.portfolioUrl ? (
                  <a
                    href={student.profile.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.teammateLink}
                  >
                    {student.profile.portfolioUrl}
                  </a>
                ) : "—"}
              </dd>
              <dt>Регистрация</dt>
              <dd>{new Date(student.createdAt).toLocaleDateString("ru-RU")}</dd>
            </dl>
          ) : (
            <p className={styles.empty}>Профиль не заполнен</p>
          )}
        </div>

        {student.profile && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Компетенции</h3>
            {student.profile.competencies.length > 0 ? (
              <div className={styles.tags}>
                {student.profile.competencies.map((tag) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>Не указаны</p>
            )}

            <h3 className={styles.cardTitle} style={{ marginTop: 16 }}>Желаемые роли</h3>
            {student.profile.desiredRoles.length > 0 ? (
              <div className={styles.tags}>
                {student.profile.desiredRoles.map((r) => (
                  <span key={r} className={styles.tag}>{r}</span>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>Не указаны</p>
            )}
          </div>
        )}

        {student.profile?.about && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>О себе</h3>
            <p className={styles.text}>{student.profile.about}</p>
          </div>
        )}
      </div>

      <h2 className={styles.sectionTitle}>Проекты ({student.projects.length})</h2>
      {student.projects.length === 0 ? (
        <p className={styles.empty}>Студент не участвует в проектах</p>
      ) : (
        student.projects.map((p) => (
          <div key={p.id} className={styles.projectCard}>
            <div className={styles.projectHeader}>
              <a href={`/projects/${p.id}`} className={styles.projectTitle}>{p.title}</a>
              <span className={styles.statusBadge}>{STATUS_LABELS[p.status] || p.status}</span>
              <span className={styles.roleBadge}>{p.role}</span>
            </div>
            <p className={styles.projectMeta}>
              Научный руководитель: {p.supervisorName || "не назначен"}
              {" · "}В проекте с {new Date(p.joinedAt).toLocaleDateString("ru-RU")}
            </p>
            <h4 className={styles.cardTitle}>Сокомандники ({p.teammates.length})</h4>
            {p.teammates.length === 0 ? (
              <p className={styles.empty}>Нет других участников</p>
            ) : (
              <ul className={styles.teammates}>
                {p.teammates.map((tm, i) => (
                  <li key={i}>
                    {tm.userId ? (
                      <a href={`/admin/students/${tm.userId}`} className={styles.teammateLink}>
                        {tm.name}
                      </a>
                    ) : (
                      tm.name
                    )}
                    {" — "}{tm.role}
                    {tm.email && <span className={styles.muted}> · {tm.email}</span>}
                    {!tm.inSystem && <span className={styles.muted}> (не в системе)</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
}
