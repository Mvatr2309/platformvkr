"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./landing.module.css";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Если уже залогинен — редирект
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const role = session.user.role;
      const profileCompleted = session.user.profileCompleted;
      if (role === "ADMIN") {
        router.push("/admin");
      } else if (!profileCompleted) {
        document.cookie = "profile_completed=; path=/; max-age=0";
        router.push(role === "STUDENT" ? "/profile/student" : "/profile");
      } else {
        router.push("/my-projects");
      }
    }
  }, [status, session, router]);

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
    const sess = await res.json();
    const role = sess?.user?.role;
    const profileCompleted = sess?.user?.profileCompleted;

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
    <main className={styles.page}>
      <div className={styles.split}>
        {/* Left — info */}
        <div className={styles.left}>
          <h1 className={styles.title}>Платформа ВКР</h1>
          <p className={styles.subtitle}>
            Сопровождение выпускных
            <br />
            квалификационных работ Центра «Пуск»
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
