"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./expert.module.css";

// FR-08: подключение роли эксперта одним нажатием (08.05).
// После успеха перечитываем сессию — без этого JWT останется старым
// и плитка «Экспертная труба» продолжит показывать приглашение.

export default function JoinButton() {
  const { update: updateSession } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/expert/join", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Не удалось подключить роль");
        return;
      }
      await updateSession();
      // Карточка предзаполнена из профиля НР — сразу ведём её проверить
      router.push("/expert/profile");
    } catch {
      setError("Не удалось подключить роль");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <p className={styles.stubError}>{error}</p>}
      <button type="button" onClick={handleJoin} disabled={busy} className={styles.stubLink}>
        {busy ? "Подключаем…" : "Принять участие"}
      </button>
    </>
  );
}
