"use client";

import styles from "./register.module.css";

export default function RegisterPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Регистрация</h1>
        <p className={styles.subtitle}>
          Регистрация на платформе осуществляется через администратора.
        </p>
        <p className={styles.subtitle}>
          Данные для входа (логин и пароль) будут отправлены на вашу почту.
        </p>
        <p className={styles.subtitle}>
          По вопросам доступа обращайтесь к администратору платформы.
        </p>
        <div style={{ marginTop: 24 }}>
          <a href="/login" className={styles.link} style={{ fontSize: 15 }}>
            Перейти ко входу
          </a>
        </div>
      </div>
    </div>
  );
}
