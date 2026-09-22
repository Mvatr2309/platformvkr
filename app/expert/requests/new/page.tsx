import { redirect } from "next/navigation";
import { checkCatalogAccess, getCatalogCard } from "@/lib/expert-catalog";
import styles from "../../expert.module.css";

// FR-08: анкета запроса на консультацию (08.12). Форма — этап 6.
// Заглушка стоит здесь, чтобы путь из каталога был виден целиком.

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ expertId?: string }>;
}) {
  const access = await checkCatalogAccess();
  if (!access.ok) {
    redirect(access.status === 401 ? "/login" : "/expert");
  }

  const { expertId } = await searchParams;
  const card = expertId ? await getCatalogCard(expertId) : null;

  return (
    <main className={styles.stubPage}>
      <div className={styles.stubCard}>
        <h1 className={styles.stubTitle}>Запрос на консультацию</h1>
        {card && (
          <p className={styles.stubText}>
            Эксперт: <strong>{card.user.name}</strong>
            {card.position ? `, ${card.position}` : ""}
            {card.workplace ? `, ${card.workplace}` : ""}
          </p>
        )}
        <p className={styles.stubText}>
          Здесь будет анкета: что хотите обсудить, какой результат ждёте от встречи и что
          уже сделали сами. Программа и курс подтянутся из вашего профиля.
        </p>
        <p className={styles.stubNote}>Форма появится на следующем этапе.</p>
        <a href={expertId ? `/expert/catalog/${expertId}` : "/expert/catalog"} className={styles.stubLink}>
          Вернуться к карточке
        </a>
      </div>
    </main>
  );
}
