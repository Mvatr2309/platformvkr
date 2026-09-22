import { redirect } from "next/navigation";
import { getSpacesAccess } from "@/lib/expert-access";
import styles from "./expert.module.css";

// FR-08: точка входа в пространство трубы.
// Каталог для студента и кабинет для эксперта появятся на этапах 3 и 5.

export default async function ExpertHomePage() {
  const access = await getSpacesAccess();
  if (!access) redirect("/login");

  // НР без роли эксперта попадает на подключение роли (08.05)
  if (access.expert.state === "INVITE") redirect("/expert/join");

  return (
    <main className={styles.stubPage}>
      <div className={styles.stubCard}>
        <h1 className={styles.stubTitle}>Экспертная труба</h1>
        <p className={styles.stubText}>
          Раздел в разработке. Каталог экспертов и запросы на консультацию появятся
          на следующих этапах.
        </p>
      </div>
    </main>
  );
}
