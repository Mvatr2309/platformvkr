import { redirect } from "next/navigation";
import { getSpacesAccess } from "@/lib/expert-access";
import styles from "../expert.module.css";

// FR-08: карточка эксперта (08.08). Форма и сохранение — этап 3.
// Страница существует уже на этапе 2, потому что на неё ведёт гейт
// незаполненного профиля для роли EXPERT.

export default async function ExpertProfilePage() {
  const access = await getSpacesAccess();
  if (!access) redirect("/login");

  // НР без подключённой роли сначала подключает её
  if (access.expert.state === "INVITE") redirect("/expert/join");

  return (
    <main className={styles.stubPage}>
      <div className={styles.stubCard}>
        <h1 className={styles.stubTitle}>Карточка эксперта</h1>
        <p className={styles.stubText}>
          Здесь будет карточка: место работы, должность, звание и степень, резюме, темы
          консультаций и контакт. Контакт увидит только студент с принятым запросом.
        </p>
        <p className={styles.stubNote}>Форма появится на следующем этапе.</p>
      </div>
    </main>
  );
}
