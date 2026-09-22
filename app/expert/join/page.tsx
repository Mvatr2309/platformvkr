import { redirect } from "next/navigation";
import { getSpacesAccess } from "@/lib/expert-access";
import styles from "../expert.module.css";

// FR-08: подключение роли эксперта научным руководителем (08.05).
// Сама кнопка и POST /api/expert/join появятся на этапе 3.

export default async function ExpertJoinPage() {
  const access = await getSpacesAccess();
  if (!access) redirect("/login");

  // Роль уже подключена — здесь делать нечего
  if (access.expert.state === "OPEN") redirect("/expert");

  return (
    <main className={styles.stubPage}>
      <div className={styles.stubCard}>
        <h1 className={styles.stubTitle}>Принять участие в роли эксперта</h1>
        <p className={styles.stubText}>
          Вы сможете разместить карточку эксперта и принимать запросы студентов на
          консультации. Роль добавляется к вашей текущей — доступ к научному руководству
          сохраняется.
        </p>
        <p className={styles.stubNote}>Кнопка подключения появится на следующем этапе.</p>
      </div>
    </main>
  );
}
