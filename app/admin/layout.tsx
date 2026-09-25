import styles from "./admin.module.css";
import LogoutButton from "./LogoutButton";
import AdminNav from "./AdminNav";
import SpaceSwitcher from "@/components/layout/SpaceSwitcher";

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
        {/* FR-08: из админки платформы — в экспертную трубу, как из остальных сайдбаров */}
        <SpaceSwitcher />
        <AdminNav />
        <div className={styles.sidebarFooter}>
          <LogoutButton />
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
