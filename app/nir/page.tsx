import styles from "./nir.module.css";

// Раздел НИР — сдача файлов по научно-исследовательской работе
export default function NirPage() {
  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>НИР</h1>
      <p className={styles.subtitle}>
        Сдача материалов по научно-исследовательской работе. Выберите семестр.
      </p>

      <div className={styles.tiles}>
        <a href="/nir/3" className={styles.tile}>
          <span className={styles.tileNumber}>3</span>
          <span className={styles.tileLabel}>НИР 3</span>
          <span className={styles.tileHint}>Сдача файлов</span>
        </a>
        <a href="/nir/4" className={styles.tile}>
          <span className={styles.tileNumber}>4</span>
          <span className={styles.tileLabel}>НИР 4</span>
          <span className={styles.tileHint}>Сдача файлов</span>
        </a>
      </div>
    </div>
  );
}
