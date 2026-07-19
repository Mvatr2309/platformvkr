import { notFound } from "next/navigation";
import styles from "../nir.module.css";

// Страница семестра НИР — пока заглушка, формы сдачи файлов будут добавлены позже
export default async function NirSemesterPage({ params }: { params: Promise<{ semester: string }> }) {
  const { semester } = await params;
  if (!["3", "4"].includes(semester)) notFound();

  return (
    <div className={styles.wrapper}>
      <a href="/nir" className={styles.back}>← НИР</a>
      <h1 className={styles.title}>НИР {semester}</h1>

      <div className={styles.stub}>
        <div className={styles.stubIcon}>🛠</div>
        <div className={styles.stubTitle}>Раздел в проработке</div>
        <p className={styles.stubText}>
          Здесь появится форма сдачи файлов по НИР {semester}.
          <br />
          Мы сообщим, когда раздел заработает.
        </p>
      </div>
    </div>
  );
}
