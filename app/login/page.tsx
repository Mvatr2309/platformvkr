"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Неверный e-mail или пароль");
      setLoading(false);
      return;
    }

    // Получаем сессию, чтобы узнать роль и статус профиля
    const res = await fetch("/api/auth/session");
    const session = await res.json();
    const role = session?.user?.role;
    const profileCompleted = session?.user?.profileCompleted;

    if (role === "ADMIN") {
      window.location.href = "/admin";
    } else if (!profileCompleted) {
      // Очищаем cookie от предыдущих сессий, чтобы profile gate работал корректно
      document.cookie = "profile_completed=; path=/; max-age=0";
      window.location.href = role === "STUDENT" ? "/profile/student" : "/profile";
    } else {
      window.location.href = "/my-projects";
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Вход на платформу</h1>
        <p className={styles.subtitle}>Платформа управления ВКР</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="user@mipt.ru"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
