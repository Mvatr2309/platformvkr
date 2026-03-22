import styles from "./admin.module.css";
import LogoutButton from "./LogoutButton";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.adminLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>ВКР</span>
          <span className={styles.badge}>Админ</span>
        </div>
        <nav className={styles.nav}>
          <a href="/admin/dashboard" className={styles.navLink}>
            Дашборд
          </a>
          <a href="/admin/invitations" className={styles.navLink}>
            Создание аккаунтов
          </a>
          <a href="/admin/students-list" className={styles.navLink}>
            Список студентов
          </a>
          <a href="/admin/supervisors-list" className={styles.navLink}>
            Список НР
          </a>
          <a href="/admin/projects" className={styles.navLink}>
            Модерация проектов
          </a>
          <a href="/admin/projects-list" className={styles.navLink}>
            Список проектов
          </a>
          <a href="/admin/calendar" className={styles.navLink}>
            Календарь
          </a>
          <a href="/admin/dictionaries" className={styles.navLink}>
            Справочники
          </a>
        </nav>
        <div className={styles.sidebarFooter}>
          <LogoutButton />
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
