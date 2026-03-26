"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Дашборд" },
  { href: "/admin/invitations", label: "Создание аккаунтов" },
  { href: "/admin/students-list", label: "Список студентов" },
  { href: "/admin/supervisors-list", label: "Научные руководители" },
  { href: "/admin/projects", label: "Модерация проектов" },
  { href: "/admin/projects-list", label: "Список проектов" },
  { href: "/admin/calendar", label: "Календарь" },
  { href: "/admin/knowledge-base", label: "База знаний" },
  { href: "/admin/feedback", label: "Обратная связь" },
  { href: "/admin/dictionaries", label: "Справочники" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
