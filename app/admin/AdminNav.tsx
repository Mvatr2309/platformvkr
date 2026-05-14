"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "",
    items: [
      { href: "/admin/dashboard", label: "Дашборд" },
    ],
  },
  {
    title: "Пользователи",
    items: [
      { href: "/admin/invitations", label: "Создание аккаунтов" },
      { href: "/admin/students-list", label: "Список студентов" },
      { href: "/admin/supervisors-list", label: "Научные руководители" },
      { href: "/admin/workload", label: "Нагрузка НР" },
    ],
  },
  {
    title: "Проекты",
    items: [
      { href: "/admin/projects", label: "Модерация" },
      { href: "/admin/projects-list", label: "Список проектов" },
    ],
  },
  {
    title: "Контент",
    items: [
      { href: "/admin/calendar", label: "Календарь" },
      { href: "/admin/knowledge-base", label: "База знаний" },
    ],
  },
  {
    title: "Система",
    items: [
      { href: "/admin/feedback", label: "Обратная связь" },
      { href: "/admin/dictionaries", label: "Справочники" },
    ],
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className={styles.navGroup}>
          {group.title && (
            <div className={styles.navGroupTitle}>{group.title}</div>
          )}
          {group.items.map((item) => {
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
        </div>
      ))}
    </nav>
  );
}
