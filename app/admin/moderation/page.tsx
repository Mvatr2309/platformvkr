"use client";

import { useState, useEffect, useCallback } from "react";
import Pagination, { usePagination } from "@/components/Pagination";
import styles from "./moderation.module.css";

interface PendingProfile {
  id: string;
  workplace: string;
  position: string;
  academicTitle: string;
  academicDegree: string;
  expertise: string[];
  updatedAt: string;
  user: { name: string; email: string };
}

export default function ModerationPage() {
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    const res = await fetch("/api/admin/moderation");
    if (res.ok) {
      setProfiles(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const { page, setPage, totalPages, paged } = usePagination(profiles, 20);

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <h1 className={styles.title}>Модерация профилей</h1>
      <p className={styles.subtitle}>
        {profiles.length === 0
          ? "Нет профилей, ожидающих модерации"
          : `${profiles.length} профил${profiles.length === 1 ? "ь" : profiles.length < 5 ? "я" : "ей"} на модерации`}
      </p>

      {profiles.length > 0 && (
        <div className={styles.list}>
          {paged.map((p) => (
            <a key={p.id} href={`/admin/moderation/${p.id}`} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.name}>{p.user.name}</span>
                <span className={styles.badge}>На модерации</span>
              </div>
              <div className={styles.cardMeta}>
                <span>{p.workplace}</span>
                <span>·</span>
                <span>{p.position}</span>
                <span>·</span>
                <span>{p.academicDegree}</span>
              </div>
              <div className={styles.cardTags}>
                {p.expertise.slice(0, 5).map((tag) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
                {p.expertise.length > 5 && (
                  <span className={styles.tagMore}>+{p.expertise.length - 5}</span>
                )}
              </div>
              <div className={styles.cardDate}>
                Отправлено: {new Date(p.updatedAt).toLocaleDateString("ru-RU")}
              </div>
            </a>
          ))}
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
