import { redirect, notFound } from "next/navigation";
import { checkCatalogAccess, getCatalogCard } from "@/lib/expert-catalog";
import styles from "../catalog.module.css";

// FR-08: карточка эксперта в каталоге (08.10, 08.11).
// Контактов здесь нет — они откроются студенту только после принятия запроса.

const PROJECT_TYPE_LABELS: Record<string, string> = {
  CLASSIC_DISSERTATION: "Исследования",
  STARTUP: "Стартапы",
  CORPORATE_STARTUP: "Корпоративные стартапы",
};

export default async function ExpertCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await checkCatalogAccess();
  if (!access.ok) {
    redirect(access.status === 401 ? "/login" : "/expert");
  }

  const { id } = await params;
  const card = await getCatalogCard(id);
  if (!card) notFound();

  return (
    <div className={styles.wrapper}>
      <a href="/expert/catalog" className={styles.backLink}>← К каталогу</a>

      <div className={styles.detailCard}>
        <div className={styles.detailTop}>
          {card.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.photoUrl} alt="" className={styles.detailAvatar} />
          ) : (
            <div className={styles.detailAvatarPlaceholder}>
              {(card.user.name || "?").charAt(0)}
            </div>
          )}
          <div>
            <h1 className={styles.detailName}>{card.user.name || "Без имени"}</h1>
            <div className={styles.detailMeta}>
              {[card.position, card.workplace].filter(Boolean).join(" · ")}
            </div>
            {(card.academicTitle || card.academicDegree) && (
              <div className={styles.cardDegree}>
                {[card.academicTitle, card.academicDegree].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </div>

        {card.helpTopics && (
          <section className={styles.detailSection}>
            <h2 className={styles.detailSectionTitle}>С какими темами поможет</h2>
            <p className={styles.detailText}>{card.helpTopics}</p>
          </section>
        )}

        {card.expertise.length > 0 && (
          <section className={styles.detailSection}>
            <h2 className={styles.detailSectionTitle}>Доменная экспертиза</h2>
            <div className={styles.cardTags}>
              {card.expertise.map((t) => (
                <span key={t} className={styles.tag}>{t}</span>
              ))}
            </div>
          </section>
        )}

        {(card.directions.length > 0 || card.projectTypes.length > 0) && (
          <section className={styles.detailSection}>
            <h2 className={styles.detailSectionTitle}>Кого консультирует</h2>
            {card.directions.length > 0 && (
              <p className={styles.detailText}>
                Направления: {card.directions.join(", ")}
              </p>
            )}
            {card.projectTypes.length > 0 && (
              <p className={styles.detailText}>
                Типы проектов:{" "}
                {card.projectTypes.map((t) => PROJECT_TYPE_LABELS[t] || t).join(", ")}
              </p>
            )}
          </section>
        )}

        {card.resumeUrl && (
          <section className={styles.detailSection}>
            <h2 className={styles.detailSectionTitle}>Опыт</h2>
            <a
              href={card.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.resumeLink}
            >
              {card.resumeUrl.startsWith("http") ? "Открыть резюме" : "Посмотреть резюме"}
            </a>
          </section>
        )}

        <div className={styles.detailActions}>
          <a href={`/expert/requests/new?expertId=${card.id}`} className={styles.primaryButton}>
            Оставить запрос
          </a>
          <p className={styles.detailNote}>
            Контакты эксперта откроются после того, как запрос одобрит модератор
            и примет сам эксперт.
          </p>
        </div>
      </div>
    </div>
  );
}
