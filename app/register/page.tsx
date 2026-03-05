"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./register.module.css";

function RegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"SUPERVISOR" | "STUDENT">("STUDENT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenLoading, setTokenLoading] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invitations/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setName(data.name);
        setEmail(data.email);
        setRole("SUPERVISOR");
      })
      .catch(() => {
        setError("Недействительная или использованная ссылка приглашения");
      })
      .finally(() => setTokenLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка регистрации");
        setLoading(false);
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push("/login");
      } else {
        router.push("/profile");
        router.refresh();
      }
    } catch {
      setError("Ошибка сети");
      setLoading(false);
    }
  }

  if (tokenLoading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <p className={styles.subtitle}>Загрузка данных приглашения...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Регистрация</h1>
        <p className={styles.subtitle}>
          {token
            ? "Вы приглашены как научный руководитель"
            : "Создайте аккаунт на платформе ВКР"}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>ФИО</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              placeholder="Иванов Иван Иванович"
              required
              readOnly={!!token}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="user@mipt.ru"
              required
              readOnly={!!token}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Минимум 6 символов"
              minLength={6}
              required
            />
          </div>

          {!token && (
            <div className={styles.field}>
              <label className={styles.label}>Роль</label>
              <div className={styles.roleGroup}>
                <button
                  type="button"
                  className={`${styles.roleOption} ${role === "STUDENT" ? styles.roleActive : ""}`}
                  onClick={() => setRole("STUDENT")}
                >
                  Студент
                </button>
                <button
                  type="button"
                  className={`${styles.roleOption} ${role === "SUPERVISOR" ? styles.roleActive : ""}`}
                  onClick={() => setRole("SUPERVISOR")}
                >
                  Научный руководитель
                </button>
              </div>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Регистрация..." : "Зарегистрироваться"}
          </button>
        </form>

        <p className={styles.footer}>
          Уже есть аккаунт?{" "}
          <a href="/login" className={styles.link}>
            Войти
          </a>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.wrapper}>
          <div className={styles.card}>
            <p className={styles.subtitle}>Загрузка...</p>
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
