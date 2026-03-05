"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./landing.module.css";

export default function Home() {
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

    setLoading(false);

    if (result?.error) {
      setError("Неверный e-mail или пароль");
      return;
    }

    // Получаем сессию, чтобы узнать роль
    const res = await fetch("/api/auth/session");
    const session = await res.json();
    const role = session?.user?.role;

    if (role === "ADMIN") router.push("/admin");
    else if (role === "STUDENT") router.push("/my-projects");
    else router.push("/my-projects");
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <div className={styles.split}>
        {/* Left — info */}
        <div className={styles.left}>
          <h1 className={styles.title}>Платформа ВКР</h1>
          <p className={styles.subtitle}>
            Сопровождение выпускных
            <br />
            квалификационных работ МФТИ
          </p>
        </div>

        {/* Right — login form */}
        <div className={styles.right}>
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Вход</h2>

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
      </div>
    </main>
  );
}
