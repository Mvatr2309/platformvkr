import { redirect } from "next/navigation";
import { canEnterExpertSpace } from "@/lib/expert-access";
import styles from "./expert.module.css";

// FR-08: гейт пространства «Экспертная труба».
// Источник: specs/08-FR-08-expert-pipeline.md (разделы 3.2, 4)
//
// Проверка на сервере обязательна: замок на плитке закрывает только визуальный
// путь, прямой переход по URL должен упираться в заглушку, а не в 404 (08.07).
// Когорту студента в middleware проверить нельзя — там нет доступа к БД,
// поэтому гейт живёт здесь.

export default async function ExpertLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { allowed, access } = await canEnterExpertSpace();

  if (!access) redirect("/login");

  if (!allowed) {
    return (
      <main className={styles.stubPage}>
        <div className={styles.stubCard}>
          <h1 className={styles.stubTitle}>Раздел ещё не открыт</h1>
          <p className={styles.stubText}>
            «Экспертная труба» пока недоступна для вашего потока. Когда раздел откроют,
            он появится на экране выбора без каких-либо действий с вашей стороны.
          </p>
          <a href="/spaces" className={styles.stubLink}>
            Вернуться к выбору раздела
          </a>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
