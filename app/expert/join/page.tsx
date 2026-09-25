import { redirect } from "next/navigation";
import { getSpacesAccess } from "@/lib/expert-access";
import JoinButton from "../JoinButton";
import styles from "../expert.module.css";

// FR-08: подключение роли эксперта научным руководителем (08.05).

export default async function ExpertJoinPage() {
  const access = await getSpacesAccess();
  if (!access) redirect("/login");

  // Роль уже подключена — здесь делать нечего
  if (access.expert.state === "OPEN") redirect("/expert");

  return (
    <main className={styles.stubPage}>
      <div className={styles.stubCard}>
        <h1 className={styles.stubTitle}>Принять участие в роли эксперта</h1>
        {/* A3: что происходит до и после нажатия (specs/08-FR-08-requirements-v2.md) */}
        <p className={styles.stubText}>
          Вы пока не эксперт экспертной трубы. Эксперты безвозмездно консультируют студентов
          по своим темам — до двух часовых встреч в месяц.
        </p>
        <p className={styles.stubText}>
          Нажмите «Принять участие» и проверьте карточку: мы заполним её из вашего профиля
          научного руководителя. Допишите темы, доменную экспертизу, кого консультируете и
          контакты, при желании загрузите свежее резюме. Карточка появится в каталоге сразу,
          без модерации. Скрыть её можно в любой момент.
        </p>
        <JoinButton />
      </div>
    </main>
  );
}
