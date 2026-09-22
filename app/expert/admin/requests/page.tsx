import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/roles";
import styles from "../../expert.module.css";

// FR-08: очередь модерации запросов (08.13). Наполнение — этап 6.
// Модератор — существующая роль ADMIN, отдельной роли модератора нет.

export default async function ExpertModerationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== UserRole.ADMIN) redirect("/spaces");

  return (
    <main className={styles.stubPage}>
      <div className={styles.stubCard}>
        <h1 className={styles.stubTitle}>Модерация запросов</h1>
        <p className={styles.stubText}>
          Очередь запросов на консультацию появится на этапе реализации запросов.
        </p>
      </div>
    </main>
  );
}
