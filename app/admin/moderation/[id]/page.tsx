"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import styles from "./detail.module.css";

interface Profile {
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
  maxProjects: number;
  contact: string;
  status: string;
  moderationComment: string | null;
  user: { name: string; email: string };
}

export default function ModerationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchProfile = useCallback(async () => {
    const res = await fetch(`/api/admin/moderation/${id}`);
    if (res.ok) {
      setProfile(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleAction(action: "approve" | "reject") {
    if (action === "reject" && !comment.trim()) {
      setError("Укажите причину отклонения");
      return;
    }

    setActing(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/moderation/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment }),
      });

      if (res.ok) {
        setMessage(action === "approve" ? "Профиль подтверждён" : "Профиль отклонён");
        setTimeout(() => router.push("/admin/moderation"), 1500);
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setActing(false);
    }
  }

  if (loading) return <p>Загрузка...</p>;
  if (!profile) return <p>Профиль не найден</p>;

  return (
    <div>
      <a href="/admin/moderation" className={styles.back}>← Назад к очереди</a>

      <div className={styles.header}>
        <div className={styles.headerInfo}>
          {profile.photoUrl && (
            <img src={profile.photoUrl} alt="Фото" className={styles.photo} />
          )}
          <div>
            <h1 className={styles.name}>{profile.user.name}</h1>
            <p className={styles.email}>{profile.user.email}</p>
          </div>
        </div>
      </div>

      {/* Данные профиля */}
      <div className={styles.grid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Основная информация</h3>
          <dl className={styles.dl}>
            <dt>Место работы</dt>
            <dd>{profile.workplace}</dd>
            <dt>Должность</dt>
            <dd>{profile.position}</dd>
            <dt>Учёное звание</dt>
            <dd>{profile.academicTitle}</dd>
            <dt>Учёная степень</dt>
            <dd>{profile.academicDegree}</dd>
            <dt>Контакт</dt>
            <dd>{profile.contact}</dd>
            <dt>Макс. проектов</dt>
            <dd>{profile.maxProjects}</dd>
          </dl>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Экспертиза</h3>
          <div className={styles.tags}>
            {profile.expertise.map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>

          <h3 className={styles.cardTitle} style={{ marginTop: 16 }}>Направления</h3>
          <div className={styles.tags}>
            {profile.directions.map((d) => (
              <span key={d} className={styles.tag}>{d}</span>
            ))}
          </div>
        </div>

        {profile.proposedTopics && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Предлагаемые темы</h3>
            <p className={styles.text}>{profile.proposedTopics}</p>
          </div>
        )}

        {profile.resumeUrl && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Резюме</h3>
            <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
              Открыть файл
            </a>
          </div>
        )}
      </div>

      {/* Действия модерации */}
      {profile.status === "PENDING" && (
        <div className={styles.moderationBlock}>
          <h3 className={styles.cardTitle}>Решение</h3>

          <div className={styles.commentField}>
            <label className={styles.label}>Комментарий (обязателен при отклонении)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={styles.textarea}
              rows={3}
              placeholder="Укажите причину отклонения или замечания..."
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}

          <div className={styles.actions}>
            <button
              onClick={() => handleAction("approve")}
              className={styles.approveButton}
              disabled={acting}
            >
              Подтвердить
            </button>
            <button
              onClick={() => handleAction("reject")}
              className={styles.rejectButton}
              disabled={acting}
            >
              Отклонить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
