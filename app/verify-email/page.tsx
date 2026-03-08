"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./verify.module.css";

function VerifyForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code || !password) {
      setError("Введите код и пароль");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка подтверждения");
        setLoading(false);
        return;
      }

      // Email подтверждён — входим
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Подтверждение прошло, но пароль неверный
        setError("Email подтверждён, но неверный пароль. Перейдите на страницу входа.");
        setLoading(false);
        return;
      }

      router.push("/profile");
      router.refresh();
    } catch {
      setError("Ошибка сети");
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setMessage("Новый код отправлен на вашу почту");
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка отправки");
      }
    } catch {
      setError("Ошибка сети");
    }
    setResending(false);
  }

  if (!email) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <p className={styles.error}>Email не указан</p>
          <a href="/register" className={styles.link}>Вернуться к регистрации</a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Подтверждение email</h1>
        <p className={styles.subtitle}>
          Мы отправили 6-значный код на <strong>{email}</strong>
        </p>

        <form onSubmit={handleVerify} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Код подтверждения</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={styles.codeInput}
              placeholder="000000"
              maxLength={6}
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Пароль (для входа после подтверждения)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Ваш пароль"
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}

          <button type="submit" className={styles.button} disabled={loading || code.length !== 6}>
            {loading ? "Проверка..." : "Подтвердить"}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Не получили код?{" "}
            <button
              onClick={handleResend}
              className={styles.resendBtn}
              disabled={resending}
            >
              {resending ? "Отправка..." : "Отправить повторно"}
            </button>
          </p>
          <a href="/login" className={styles.link}>Вернуться ко входу</a>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.wrapper}>
          <div className={styles.card}>
            <p>Загрузка...</p>
          </div>
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
