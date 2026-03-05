import styles from "./admin.module.css";

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
            Приглашения
          </a>
          <a href="/admin/moderation" className={styles.navLink}>
            Модерация
          </a>
          <a href="/admin/matching" className={styles.navLink}>
            Метчинг
          </a>
          <a href="/admin/dictionaries" className={styles.navLink}>
            Справочники
          </a>
        </nav>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
