import { redirect } from "next/navigation";
import { canEnterVkrSpace } from "@/lib/expert-access";
import styles from "./vkrgate.module.css";

// A1: гейт пространства «Платформа ВКР» для студентов закрытого потока.
// Источник: specs/08-FR-08-requirements-v2.md (A1)
//
// Стоит в layout.tsx каждого раздела платформы: прямой переход по URL
// упирается в заглушку, как в экспертной трубе (app/expert/layout.tsx).
// Данные при этом закрыты в API (denyVkrClosed): страницы платформы
// клиентские, а layout не перезапускается при переходах внутри раздела.
//
// ВАЖНО: layout в Next — не граница доступа. Сегмент страницы рендерится и уходит
// в RSC-ответ, даже если layout показал заглушку, а частичный RSC-запрос отдаёт
// страницу вообще без layout. Поэтому в разделах платформы страницы только
// клиентские, данные — только через API с denyVkrClosed. Серверная
// страница с запросом в БД в этих разделах обязана сама вызвать canEnterVkrSpace().

export default async function VkrGate({ children }: { children: React.ReactNode }) {
  const { authed, allowed } = await canEnterVkrSpace();

  if (!authed) redirect("/login");

  if (!allowed) {
    return (
      <main className={styles.stubPage}>
        <div className={styles.stubCard}>
          <h1 className={styles.stubTitle}>Раздел ещё не открыт</h1>
          <p className={styles.stubText}>
            «Платформа ВКР» пока недоступна для вашего потока. Когда раздел откроют,
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
