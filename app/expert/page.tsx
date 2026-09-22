import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSpacesAccess } from "@/lib/expert-access";
import { UserRole } from "@/types/roles";
import styles from "./expert.module.css";

// FR-08: точка входа в пространство трубы.
// Каталог для студента — этап 5, запросы — этап 6.

export default async function ExpertHomePage() {
  const access = await getSpacesAccess();
  if (!access) redirect("/login");

  // НР без роли эксперта попадает на подключение роли (08.05)
  if (access.expert.state === "INVITE") redirect("/expert/join");

  // Админ работает в админке трубы
  if (access.role === UserRole.ADMIN) redirect("/expert/admin/requests");

  // Студенту точка входа в трубу — каталог экспертов (08.10)
  if (access.role === UserRole.STUDENT) redirect("/expert/catalog");

  const session = await auth();
  const card = session?.user?.id
    ? await prisma.expertProfile.findUnique({
        where: { userId: session.user.id },
        select: { cardCompleted: true, hiddenByOwner: true },
      })
    : null;

  // Эксперт — это внешний эксперт (роль EXPERT) или НР с подключённой ролью.
  // У приглашённого админом эксперта карточки может ещё не быть вовсе,
  // поэтому по одному наличию записи судить нельзя.
  const isExpert = access.role === UserRole.EXPERT || Boolean(card);

  return (
    <main className={styles.stubPage}>
      <div className={styles.stubCard}>
        <h1 className={styles.stubTitle}>Экспертная труба</h1>

        {isExpert && !card && (
          <p className={styles.stubBanner}>
            Карточка ещё не создана — студенты вас не видят. Заполните её, и вы появитесь
            в каталоге сразу, без модерации.
          </p>
        )}

        {isExpert && card && !card.cardCompleted && (
          <p className={styles.stubBanner}>
            Карточка не заполнена — студенты вас не видят. Заполните обязательные поля,
            и карточка появится в каталоге сразу, без модерации.
          </p>
        )}

        {isExpert && card?.cardCompleted && card.hiddenByOwner && (
          <p className={styles.stubBanner}>
            Карточка скрыта из каталога по вашему решению. Пока она скрыта, новые запросы
            к вам не приходят.
          </p>
        )}

        {isExpert && card?.cardCompleted && !card.hiddenByOwner && (
          <p className={styles.stubText}>
            Карточка заполнена и видна студентам. Запросы на консультацию появятся здесь,
            когда раздел откроют студентам.
          </p>
        )}

        {isExpert ? (
          <a href="/expert/profile" className={styles.stubLink}>
            Открыть карточку
          </a>
        ) : (
          <p className={styles.stubText}>
            Каталог экспертов и отправка запросов появятся на следующих этапах.
          </p>
        )}
      </div>
    </main>
  );
}
