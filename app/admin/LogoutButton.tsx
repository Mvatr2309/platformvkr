"use client";

import { signOut } from "next-auth/react";
import styles from "./admin.module.css";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className={styles.logoutBtn}
    >
      Выйти
    </button>
  );
}
