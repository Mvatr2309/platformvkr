import Link from "next/link";
import styles from "./landing.module.css";

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>
            Платформа сопровождения
            <br />
            выпускных квалификационных работ
          </h1>
          <p className={styles.heroSubtitle}>
            Единое пространство для студентов, научных руководителей
            и&nbsp;администрации МФТИ. Подбор тем, управление проектами,
            календарь дедлайнов и&nbsp;база знаний — всё в&nbsp;одном месте.
          </p>
          <div className={styles.heroCta}>
            <Link href="/register" className={styles.ctaPrimary}>
              Зарегистрироваться
            </Link>
            <Link href="/login" className={styles.ctaSecondary}>
              Войти
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <h2 className={styles.featuresTitle}>Возможности платформы</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📋</div>
            <div className={styles.featureTitle}>Каталог проектов</div>
            <p className={styles.featureText}>
              Единый реестр тем ВКР с фильтрацией по направлению, типу работы
              и компетенциям. Удобный поиск подходящей темы.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🤝</div>
            <div className={styles.featureTitle}>Подбор и заявки</div>
            <p className={styles.featureText}>
              Студенты подают заявки на проекты, руководители рассматривают
              кандидатов. Автоматический матчинг по компетенциям.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📅</div>
            <div className={styles.featureTitle}>Календарь событий</div>
            <p className={styles.featureText}>
              Общий календарь дедлайнов, защит, консультаций и мероприятий.
              Экспорт в iCal и напоминания.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📚</div>
            <div className={styles.featureTitle}>База знаний</div>
            <p className={styles.featureText}>
              Регламенты, шаблоны документов, инструкции и FAQ — всё
              необходимое для подготовки ВКР собрано в одном месте.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>👥</div>
            <div className={styles.featureTitle}>Профили руководителей</div>
            <p className={styles.featureText}>
              Подробные профили научных руководителей с описанием направлений,
              компетенций и доступных слотов.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>⚙️</div>
            <div className={styles.featureTitle}>Панель администратора</div>
            <p className={styles.featureText}>
              Дашборд со статистикой, модерация профилей, управление
              приглашениями и справочниками.
            </p>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className={styles.roles}>
        <div className={styles.rolesInner}>
          <h2 className={styles.rolesTitle}>Для кого эта платформа</h2>
          <div className={styles.rolesGrid}>
            <div className={styles.roleCard}>
              <div className={styles.roleTitle}>Студент</div>
              <p className={styles.roleDesc}>
                Найдите тему ВКР, подайте заявку руководителю,
                отслеживайте дедлайны и&nbsp;готовьте документы по шаблонам.
              </p>
              <Link href="/register" className={styles.roleLink}>
                Зарегистрироваться →
              </Link>
            </div>
            <div className={styles.roleCard}>
              <div className={styles.roleTitle}>Научный руководитель</div>
              <p className={styles.roleDesc}>
                Публикуйте темы проектов, принимайте заявки студентов,
                управляйте командой и&nbsp;следите за прогрессом.
              </p>
              <Link href="/register" className={styles.roleLink}>
                Зарегистрироваться →
              </Link>
            </div>
            <div className={styles.roleCard}>
              <div className={styles.roleTitle}>Администратор</div>
              <p className={styles.roleDesc}>
                Управляйте пользователями, модерируйте профили,
                настраивайте справочники и&nbsp;отслеживайте статистику.
              </p>
              <Link href="/login" className={styles.roleLink}>
                Войти →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className={styles.stats}>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>400+</div>
            <div className={styles.statLabel}>Научных руководителей</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>400+</div>
            <div className={styles.statLabel}>Студентов</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>6</div>
            <div className={styles.statLabel}>Направлений</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>24/7</div>
            <div className={styles.statLabel}>Доступ к платформе</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        МФТИ · Платформа ВКР · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
