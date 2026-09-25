import { redirect } from "next/navigation";
import { getSpacesAccess } from "@/lib/expert-access";
import styles from "./spaces.module.css";

// FR-08: экран выбора пространства (08.01, 08.02).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 3)
//
// Показывается при заходе на сайт. Последний выбор не запоминается —
// плитки видны каждый раз. Переход по прямой ссылке из письма или уведомления
// этот экран не показывает и ведёт сразу на целевую страницу (08.04).

export const metadata = {
  title: "Выбор раздела — Платформа ВКР(С)",
};

type TileProps = {
  title: string;
  description: string;
  state: "OPEN" | "LOCKED" | "INVITE";
  href: string | null;
  lockedNote: string;
  actionLabel: string;
};

function Tile({ title, description, state, href, lockedNote, actionLabel }: TileProps) {
  const body = (
    <>
      <div className={styles.tileHead}>
        <h2 className={styles.tileTitle}>{title}</h2>
        {state === "LOCKED" && (
          <span className={styles.lock} aria-hidden="true">
            {/* Замок: пространство недоступно */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3.5" y="8.5" width="13" height="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
        )}
      </div>
      <p className={styles.tileText}>{state === "LOCKED" ? lockedNote : description}</p>
      {state !== "LOCKED" && <span className={styles.tileAction}>{actionLabel}</span>}
    </>
  );

  if (state === "LOCKED" || !href) {
    return (
      <div className={`${styles.tile} ${styles.tileLocked}`} aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <a href={href} className={`${styles.tile} ${state === "INVITE" ? styles.tileInvite : ""}`}>
      {body}
    </a>
  );
}

export default async function SpacesPage() {
  const access = await getSpacesAccess();

  // Неавторизованных отправляем на вход
  if (!access) redirect("/login");

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>Куда идём?</h1>
        <p className={styles.subheading}>Выберите раздел. Переключиться можно в любой момент.</p>

        <div className={styles.grid}>
          <Tile
            title="Платформа ВКР"
            description="Проекты, научные руководители, заявки, календарь и база знаний."
            state={access.vkr.state}
            href={access.vkr.href}
            lockedNote={
              access.role === "STUDENT"
                ? "Раздел ещё не открыт для вашего потока."
                : "Раздел доступен студентам и научным руководителям платформы."
            }
            actionLabel="Перейти"
          />
          <Tile
            title="Экспертная труба"
            description="Каталог экспертов и запросы на консультацию."
            state={access.expert.state}
            href={access.expert.href}
            lockedNote="Раздел ещё не открыт для вашего потока."
            actionLabel={access.expert.state === "INVITE" ? "Принять участие" : "Перейти"}
          />
        </div>
      </div>
    </main>
  );
}
