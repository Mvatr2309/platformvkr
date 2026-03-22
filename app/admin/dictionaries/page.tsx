"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./dictionaries.module.css";

interface DictionaryData {
  id: string;
  type: string;
  values: Array<{ id: string; value: string; sortOrder: number }>;
}

const DICT_LABELS: Record<string, string> = {
  directions: "Направления обучения",
  roles: "Роли в команде",
  academicTitles: "Учёные звания",
  cohorts: "Потоки",
};

const DICT_HINTS: Record<string, string> = {
  directions: "Образовательные программы (Управление IT продуктом, Разработка IT-продуктов...)",
  roles: "Роли в проектной команде (Разработчик, ML-инженер, Data Engineer...)",
  academicTitles: "Учёные звания для профилей НР (Нет, Доцент, Профессор...)",
  cohorts: "Потоки студентов (Поток2025, Поток2026...)",
};

const DEFAULT_TYPES = ["directions", "roles", "academicTitles", "cohorts"];

export default function DictionariesPage() {
  const [dictionaries, setDictionaries] = useState<DictionaryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/dictionaries");
    if (res.ok) {
      const data: DictionaryData[] = await res.json();
      setDictionaries(data);
      // Init edits
      const initialEdits: Record<string, string[]> = {};
      for (const type of DEFAULT_TYPES) {
        const dict = data.find((d) => d.type === type);
        initialEdits[type] = dict ? dict.values.map((v) => v.value) : [];
      }
      setEdits(initialEdits);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function updateValue(type: string, index: number, value: string) {
    setEdits((prev) => {
      const arr = [...(prev[type] || [])];
      arr[index] = value;
      return { ...prev, [type]: arr };
    });
  }

  function addValue(type: string) {
    setEdits((prev) => ({
      ...prev,
      [type]: [...(prev[type] || []), ""],
    }));
  }

  function removeValue(type: string, index: number) {
    setEdits((prev) => ({
      ...prev,
      [type]: (prev[type] || []).filter((_, i) => i !== index),
    }));
  }

  async function handleSave(type: string) {
    const values = (edits[type] || []).filter((v) => v.trim());
    setSaving((prev) => ({ ...prev, [type]: true }));
    setMessages((prev) => ({ ...prev, [type]: "" }));

    const res = await fetch("/api/admin/dictionaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, values }),
    });

    if (res.ok) {
      setMessages((prev) => ({ ...prev, [type]: "Сохранено" }));
      fetchData();
    } else {
      setMessages((prev) => ({ ...prev, [type]: "Ошибка сохранения" }));
    }

    setSaving((prev) => ({ ...prev, [type]: false }));
  }

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <h1 className={styles.title}>Справочники</h1>

      <div className={styles.grid}>
        {DEFAULT_TYPES.map((type) => (
          <div key={type} className={styles.card}>
            <div className={styles.cardTitle}>{DICT_LABELS[type] || type}</div>
            <div className={styles.hint}>{DICT_HINTS[type]}</div>

            <div className={styles.valueList}>
              {(edits[type] || []).map((val, i) => (
                <div key={i} className={styles.valueItem}>
                  <input
                    className={styles.valueInput}
                    value={val}
                    onChange={(e) => updateValue(type, i, e.target.value)}
                    placeholder="Значение..."
                  />
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeValue(type, i)}
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.actions}>
              <button className={styles.addBtn} onClick={() => addValue(type)}>
                + Добавить
              </button>
              <button
                className={styles.saveBtn}
                onClick={() => handleSave(type)}
                disabled={saving[type]}
              >
                {saving[type] ? "..." : "Сохранить"}
              </button>
            </div>

            {messages[type] && (
              <p className={messages[type] === "Сохранено" ? styles.success : styles.error}>
                {messages[type]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
