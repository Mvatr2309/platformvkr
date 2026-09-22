"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./spaceswitcher.module.css";

// FR-08: переключатель пространств (08.03).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 3)
//
// Живёт в сайдбаре обоих пространств, чтобы смена контекста не требовала
// возврата на экран выбора и тем более повторного входа. Состояние доступа
// берём с сервера — логика доступа не дублируется на клиенте.

type SpaceState = "OPEN" | "LOCKED" | "INVITE";
type Space = { state: SpaceState; href: string | null };
type Access = { vkr: Space; expert: Space };

export default function SpaceSwitcher() {
  const pathname = usePathname();
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/expert/access")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAccess(data);
      })
      .catch(() => {
        /* тихо: переключатель не критичен для работы страницы */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const inExpertSpace = pathname.startsWith("/expert");

  function row(label: string, space: Space | undefined, isCurrent: boolean) {
    if (isCurrent) {
      return (
        <span className={`${styles.row} ${styles.rowCurrent}`} aria-current="true">
          {label}
        </span>
      );
    }
    if (!space || space.state === "LOCKED") {
      return (
        <span className={`${styles.row} ${styles.rowLocked}`} aria-disabled="true">
          {label}
          <span className={styles.lock} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <rect x="3.5" y="8.5" width="13" height="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
        </span>
      );
    }
    return (
      <a href={space.href ?? "/spaces"} className={styles.row}>
        {label}
        {space.state === "INVITE" && <span className={styles.invite}>подключить</span>}
      </a>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>Раздел</div>
      {row("Платформа ВКР", access?.vkr, !inExpertSpace)}
      {row("Экспертная труба", access?.expert, inExpertSpace)}
    </div>
  );
}
