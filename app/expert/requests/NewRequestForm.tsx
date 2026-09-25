"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../expert-form.module.css";

// FR-08: анкета запроса на консультацию (08.12).
// Пороги длины отсекают запросы «просто поговорить» и разгружают модератора.
// С requestId та же анкета служит для исправления запроса, возвращённого на доработку (M1).

const MIN_TOPIC = 500;
const MIN_RESULT = 80;
const MIN_PROGRESS = 500;

type Expert = {
  id: string;
  name: string;
  position: string;
  workplace: string;
};

type Project = { id: string; title: string };

type Initial = {
  topic: string;
  expectedResult: string;
  ownProgress: string;
  materialsUrl: string | null;
  projectId: string | null;
};

export default function NewRequestForm({
  expert,
  projects,
  direction,
  course,
  requestId,
  initial,
  moderatorComment,
}: {
  expert: Expert;
  projects: Project[];
  direction: string;
  course: number;
  /** Исправление запроса на доработке (M1) */
  requestId?: string;
  initial?: Initial;
  moderatorComment?: string | null;
}) {
  const router = useRouter();
  const isRevision = Boolean(requestId);
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [expectedResult, setExpectedResult] = useState(initial?.expectedResult ?? "");
  const [ownProgress, setOwnProgress] = useState(initial?.ownProgress ?? "");
  const [materialsUrl, setMaterialsUrl] = useState(initial?.materialsUrl ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  function counter(value: string, min: number) {
    const left = min - value.trim().length;
    return left > 0 ? (
      <span className={styles.counterShort}>Ещё {left} символов</span>
    ) : (
      <span className={styles.counterOk}>Достаточно</span>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (topic.trim().length < MIN_TOPIC) {
      setError(`Опишите вопрос подробнее — минимум ${MIN_TOPIC} символов`);
      return;
    }
    if (expectedResult.trim().length < MIN_RESULT) {
      setError(`Опишите ожидаемый результат — минимум ${MIN_RESULT} символов`);
      return;
    }
    if (ownProgress.trim().length < MIN_PROGRESS) {
      setError(`Расскажите, что уже сделали сами — минимум ${MIN_PROGRESS} символов`);
      return;
    }

    setSending(true);
    try {
      const res = await fetch(isRevision ? `/api/expert/requests/${requestId}` : "/api/expert/requests", {
        method: isRevision ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expertId: expert.id,
          topic,
          expectedResult,
          ownProgress,
          materialsUrl,
          projectId: projectId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось отправить запрос");
        setSending(false);
        return;
      }
      // Кнопку не разблокируем: до перехода повторный клик дал бы ложную ошибку 409
      router.push("/expert/my-requests");
    } catch {
      setError("Не удалось отправить запрос");
      setSending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      {isRevision ? (
        <a href="/expert/my-requests" className={styles.backLink}>← К моим запросам</a>
      ) : (
        <a href={`/expert/catalog/${expert.id}`} className={styles.backLink}>← К карточке эксперта</a>
      )}
      <h1 className={styles.title}>{isRevision ? "Исправление запроса" : "Запрос на консультацию"}</h1>

      {isRevision && moderatorComment && (
        <div className={styles.revisionNote}>
          <strong>Модератор вернул запрос на доработку:</strong>
          <p>{moderatorComment}</p>
          <span>Исправьте анкету и отправьте её снова — запрос вернётся на проверку.</span>
        </div>
      )}

      <div className={styles.recipient}>
        <strong>{expert.name}</strong>
        {[expert.position, expert.workplace].filter(Boolean).length > 0 && (
          <span> · {[expert.position, expert.workplace].filter(Boolean).join(", ")}</span>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Суть запроса</h2>

          <div className={styles.field}>
            <label className={styles.label}>Что хочу обсудить *</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={styles.textarea}
              rows={8}
              placeholder="Опишите вопрос так, чтобы эксперт понял контекст: что за задача, на каком этапе вы находитесь, в чём затруднение"
            />
            <span className={styles.fieldHint}>
              Минимум {MIN_TOPIC} символов. {counter(topic, MIN_TOPIC)}
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Какой результат жду от встречи *</label>
            <textarea
              value={expectedResult}
              onChange={(e) => setExpectedResult(e.target.value)}
              className={styles.textarea}
              rows={4}
              placeholder="Напишите, с чем вы хотите уйти со встречи: выбрать метод, проверить гипотезу, получить оценку подхода. По этому полю эксперт решит, сможет ли он помочь"
            />
            <span className={styles.fieldHint}>
              Минимум {MIN_RESULT} символов. {counter(expectedResult, MIN_RESULT)}
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Что вы уже сделали сами</h2>

          <div className={styles.field}>
            <label className={styles.label}>Что уже сделал, чтобы разобраться *</label>
            <textarea
              value={ownProgress}
              onChange={(e) => setOwnProgress(e.target.value)}
              className={styles.textarea}
              rows={8}
              placeholder="Что вы посмотрели, какие подходы попробовали и чем они закончились"
            />
            <span className={styles.fieldHint}>
              Минимум {MIN_PROGRESS} символов. {counter(ownProgress, MIN_PROGRESS)}
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Материалы и контекст</h2>

          <div className={styles.field}>
            <label className={styles.label}>Ссылка на папку с материалами</label>
            <input
              type="url"
              value={materialsUrl}
              onChange={(e) => setMaterialsUrl(e.target.value)}
              className={styles.input}
              placeholder="https://drive.google.com/…"
            />
            <span className={styles.fieldHint}>
              Необязательно. Презентация проекта, литобзор, ноутбук с кодом, черновик работы.
            </span>
            {/* B2: студенты часто присылают закрытые ссылки — предупреждение не должно теряться */}
            <div className={styles.linkWarning}>
              Проверьте, что доступ открыт всем, у кого есть ссылка. Закрытую папку эксперт
              не откроет и не сможет подготовиться к встрече.
            </div>
          </div>

          {projects.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>Проект на платформе</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={styles.select}
              >
                <option value="">Не привязывать</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <span className={styles.fieldHint}>Необязательно, чтобы эксперт видел, к чему относится вопрос</span>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Программа и курс</label>
            <div className={styles.readonlyValue}>
              {direction || "не указана"}, {course} курс
            </div>
            <span className={styles.fieldHint}>
              Подставляются из вашего профиля и сохраняются в запросе на момент отправки
            </span>
          </div>
        </section>

        {error && <div className={styles.error}>{error}</div>}

        {/* B1: студент заранее знает про модерацию и лимит встреч — отказ по времени
            не воспринимается как отказ по существу */}
        <div className={styles.submitNotice}>
          <p>
            Запрос сначала проверит модератор. Если из описания непонятны задача и ожидаемый
            результат, модератор вернёт запрос на доработку с комментарием.
          </p>
          <p>
            Каждый эксперт проводит не больше двух часовых встреч в месяц. Если у эксперта
            закончились слоты, он отклонит запрос и напишет об этом в комментарии — тогда
            отправьте запрос повторно в следующем месяце.
          </p>
        </div>
        <p className={styles.fieldHint} style={{ marginBottom: 16 }}>
          Эксперту видны анкета, ваше имя и программа. Контакты откроются обеим сторонам, только
          когда эксперт примет запрос.
        </p>

        <div className={styles.actions}>
          <button type="submit" disabled={sending} className={styles.submitButton}>
            {sending ? "Отправляем…" : isRevision ? "Отправить исправленный запрос" : "Отправить запрос"}
          </button>
        </div>
      </form>
    </div>
  );
}
