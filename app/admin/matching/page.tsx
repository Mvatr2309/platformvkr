"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./matching.module.css";

interface MatchProject {
  id: string;
  title: string;
  projectType: string;
  status: string;
  direction: string | null;
  supervisor: { id: string; user: { name: string } } | null;
  _count: { members: number };
}

interface MatchSupervisor {
  id: string;
  workplace: string;
  expertise: string[];
  directions: string[];
  maxSlots: number;
  user: { name: string };
  _count: { projects: number };
}

export default function MatchingPage() {
  const [projects, setProjects] = useState<MatchProject[]>([]);
  const [supervisors, setSupervisors] = useState<MatchSupervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ projectId: string; supervisorId: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/matching");
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects);
      setSupervisors(data.supervisors);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAssign() {
    if (!selected) return;
    setError(""); setMessage("");
    const res = await fetch("/api/admin/matching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected),
    });
    if (res.ok) {
      setMessage("Руководитель назначен");
      setSelected(null);
      fetchData();
    } else {
      const data = await res.json();
      setError(data.error || "Ошибка");
    }
  }

  const unassigned = projects.filter((p) => !p.supervisor);

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <h1 className={styles.title}>Метчинг: проекты и руководители</h1>

      {message && <p className={styles.success}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <h2 className={styles.subtitle}>Проекты без руководителя ({unassigned.length})</h2>

      {unassigned.length === 0 ? (
        <p className={styles.muted}>Все проекты имеют руководителя</p>
      ) : (
        <div className={styles.list}>
          {unassigned.map((p) => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <a href={`/projects/${p.id}`} className={styles.projectLink}>{p.title}</a>
                <span className={styles.badge}>{p.direction || p.projectType}</span>
              </div>

              <div className={styles.assignRow}>
                <select
                  value={selected?.projectId === p.id ? selected.supervisorId : ""}
                  onChange={(e) => setSelected({ projectId: p.id, supervisorId: e.target.value })}
                  className={styles.select}
                >
                  <option value="">Выберите руководителя...</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.user.name} — {s.expertise.slice(0, 3).join(", ")} ({s._count.projects}/{s.maxSlots})
                    </option>
                  ))}
                </select>
                {selected?.projectId === p.id && selected.supervisorId && (
                  <button onClick={handleAssign} className={styles.assignButton}>Назначить</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className={styles.subtitle}>Доступные руководители ({supervisors.length})</h2>
      <div className={styles.supervisorGrid}>
        {supervisors.map((s) => (
          <div key={s.id} className={styles.supervisorCard}>
            <div className={styles.supervisorName}>{s.user.name}</div>
            <div className={styles.supervisorMeta}>{s.workplace}</div>
            <div className={styles.tags}>
              {s.expertise.slice(0, 4).map((t) => <span key={t} className={styles.tag}>{t}</span>)}
            </div>
            <div className={styles.slots}>{s._count.projects}/{s.maxSlots} проектов</div>
          </div>
        ))}
      </div>
    </div>
  );
}
