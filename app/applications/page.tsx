"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "./applications.module.css";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "На рассмотрении",
  ACCEPTED: "Принята",
  REJECTED: "Отклонена",
  INTERESTED: "Заинтересован",
  CONFIRMED: "Руководство подтверждено",
  DECLINED: "Отклонено",
};

interface StudentApplication {
  id: string;
  motivation: string;
  status: string;
  comment: string | null;
  createdAt: string;
  project: { id: string; title: string; status: string };
}

interface AuthorApplication {
  id: string;
  type?: string;
  motivation: string;
  role: string | null;
  status: string;
  comment: string | null;
  createdAt: string;
  project: { id: string; title: string };
  student: {
    id: string;
    direction: string;
    course: number;
    competencies: string[];
    portfolioUrl: string | null;
    contact: string;
    user: { name: string; email: string };
  } | null;
  supervisor?: {
    id: string;
    workplace: string;
    position: string;
    academicDegree: string;
    expertise: string[];
    contact: string;
    user: { name: string };
  } | null;
}

interface SupervisorOwnApp {
  id: string;
  motivation: string;
  status: string;
  comment: string | null;
  createdAt: string;
  project: { id: string; title: string; status: string };
}

interface ProposalApp {
  id: string;
  motivation: string;
  status: string;
  comment: string | null;
  createdAt: string;
  project: { id: string; title: string; description?: string; projectType?: string; status: string; direction?: string | null };
  student?: {
    id: string;
    direction: string;
    course: number;
    competencies: string[];
    portfolioUrl: string | null;
    contact: string;
    user: { name: string; email: string };
  } | null;
  supervisor?: {
    id: string;
    contact: string;
    user: { name: string };
  } | null;
}

export default function ApplicationsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [myApps, setMyApps] = useState<StudentApplication[]>([]);
  const [authorApps, setAuthorApps] = useState<AuthorApplication[]>([]);
  const [myProposals, setMyProposals] = useState<ProposalApp[]>([]);
  const [supervisorApps, setSupervisorApps] = useState<AuthorApplication[]>([]);
  const [supervisorOwnApps, setSupervisorOwnApps] = useState<SupervisorOwnApp[]>([]);
  const [supervisorProposals, setSupervisorProposals] = useState<ProposalApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"my" | "author" | "proposals">("my");
  const [supTab, setSupTab] = useState<"incoming" | "proposals" | "my">("incoming");

  const fetchApps = useCallback(async () => {
    if (role === "STUDENT") {
      const [myRes, authorRes, proposalsRes] = await Promise.all([
        fetch("/api/applications"),
        fetch("/api/applications?as=author"),
        fetch("/api/applications?as=proposals"),
      ]);
      if (myRes.ok) setMyApps(await myRes.json());
      if (authorRes.ok) setAuthorApps(await authorRes.json());
      if (proposalsRes.ok) setMyProposals(await proposalsRes.json());
    } else if (role === "SUPERVISOR") {
      const [incomingRes, myRes, proposalsRes] = await Promise.all([
        fetch("/api/applications"),
        fetch("/api/applications?as=my"),
        fetch("/api/applications?as=proposals"),
      ]);
      if (incomingRes.ok) setSupervisorApps(await incomingRes.json());
      if (myRes.ok) setSupervisorOwnApps(await myRes.json());
      if (proposalsRes.ok) setSupervisorProposals(await proposalsRes.json());
    }
    setLoading(false);
  }, [role]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  async function handleAction(id: string, action: string) {
    const res = await fetch(`/api/applications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment }),
    });
    if (res.ok) {
      const msgs: Record<string, string> = {
        accept: "Заявка принята",
        reject: "Заявка отклонена",
        interested: "Вы отметили заинтересованность. Контакты раскрыты!",
        confirm: "Руководство подтверждено!",
        decline: "Предложение отклонено",
        withdraw: "Заявка отозвана",
      };
      setMessage(msgs[action] || "Готово");
      setActionId(null);
      setComment("");
      fetchApps();
    }
  }

  if (loading) return <div className={styles.wrapper}><p>Загрузка...</p></div>;

  // Вид для студента
  if (role === "STUDENT") {
    const hasAuthorApps = authorApps.length > 0;
    const pendingAuthor = authorApps.filter((a) => a.status === "PENDING");
    const resolvedAuthor = authorApps.filter((a) => a.status !== "PENDING");

    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <h1 className={styles.title}>Заявки</h1>

          {/* Табы */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === "my" ? styles.tabActive : ""}`}
              onClick={() => setTab("my")}
            >
              <span className={styles.tabWithHint}>
                Исходящие мои заявки ({myApps.length})
                <span className={styles.hintIcon}>?<span className={styles.hintTooltip}>Заявки, которые вы подали на участие в чужих проектах</span></span>
              </span>
            </button>
            {authorApps.length > 0 && (
              <button
                className={`${styles.tab} ${tab === "author" ? styles.tabActive : ""}`}
                onClick={() => setTab("author")}
              >
                <span className={styles.tabWithHint}>
                  Входящие заявки ({authorApps.length})
                  <span className={styles.hintIcon}>?<span className={styles.hintTooltip}>Заявки на ваши проекты — от студентов (хотят войти в команду) и от научных руководителей (хотят возглавить проект)</span></span>
                </span>
              </button>
            )}
            <button
              className={`${styles.tab} ${tab === "proposals" ? styles.tabActive : ""}`}
              onClick={() => setTab("proposals")}
            >
              <span className={styles.tabWithHint}>
                Предложения руководителям ({myProposals.length})
                <span className={styles.hintIcon}>?<span className={styles.hintTooltip}>Ваши предложения научным руководителям о руководстве вашим проектом</span></span>
              </span>
            </button>
          </div>

          {message && <p className={styles.success}>{message}</p>}

          {/* Мои поданные заявки */}
          {tab === "my" && (
            <>
              {myApps.length === 0 ? (
                <p className={styles.empty}>Вы ещё не подавали заявок. <a href="/projects" className={styles.link}>Найти проект</a></p>
              ) : (
                <div className={styles.list}>
                  {myApps.map((app) => (
                    <div key={app.id} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <a href={`/projects/${app.project.id}`} className={styles.projectLink}>{app.project.title}</a>
                        <span className={`${styles.status} ${styles[`status_${app.status}`]}`}>
                          {STATUS_LABELS[app.status]}
                        </span>
                      </div>
                      <p className={styles.motivation}>{app.motivation}</p>
                      {app.comment && <p className={styles.comment}>Комментарий: {app.comment}</p>}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className={styles.date}>{new Date(app.createdAt).toLocaleDateString("ru-RU")}</span>
                        {app.status === "PENDING" && (
                          <button
                            onClick={() => { if (confirm("Отозвать заявку?")) handleAction(app.id, "withdraw"); }}
                            className={styles.rejectButton}
                            style={{ fontSize: 13, padding: "4px 12px" }}
                          >
                            Отозвать
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Заявки на мои проекты (я — автор) */}
          {tab === "author" && (
            <>
              {pendingAuthor.length > 0 && (
                <>
                  <h2 className={styles.subtitle}>На рассмотрении ({pendingAuthor.length})</h2>
                  <div className={styles.list}>
                    {pendingAuthor.map((app) => renderReviewCard(app))}
                  </div>
                </>
              )}

              {resolvedAuthor.length > 0 && (
                <>
                  <h2 className={styles.subtitle}>Рассмотренные ({resolvedAuthor.length})</h2>
                  <div className={styles.list}>
                    {resolvedAuthor.map((app) => {
                      const isSup = app.type === "SUPERVISOR";
                      const name = isSup
                        ? app.supervisor?.user.name || "Научный руководитель"
                        : app.student?.user.name || "Студент";
                      return (
                        <div key={app.id} className={`${styles.card} ${styles.cardResolved}`}>
                          <div className={styles.cardHeader}>
                            <span className={styles.studentName}>
                              <span style={{ color: isSup ? "#003092" : "#E8375A", fontWeight: 600, marginRight: 6 }}>
                                {isSup ? "[Науч. рук.]" : "[Студент]"}
                              </span>
                              {isSup && app.supervisor?.id
                                ? <a href={`/supervisors/${app.supervisor.id}`} className={styles.link}>{name}</a>
                                : name
                              }
                            </span>
                            <span className={`${styles.status} ${styles[`status_${app.status}`]}`}>
                              {STATUS_LABELS[app.status]}
                            </span>
                          </div>
                          <span className={styles.projectBadge}>{app.project.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {authorApps.length === 0 && <p className={styles.empty}>Заявок на ваши проекты пока нет</p>}
            </>
          )}

          {/* Мои предложения НР (SUPERVISION_REQUEST) */}
          {tab === "proposals" && (
            <>
              {myProposals.length === 0 ? (
                <p className={styles.empty}>Вы ещё не предлагали проекты руководителям. <a href="/supervisors" className={styles.link}>Найти руководителя</a></p>
              ) : (
                <div className={styles.list}>
                  {myProposals.map((app) => (
                    <div key={app.id} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <a href={`/projects/${app.project.id}`} className={styles.projectLink}>{app.project.title}</a>
                        <span className={`${styles.status} ${styles[`status_${app.status}`]}`}>
                          {STATUS_LABELS[app.status] || app.status}
                        </span>
                      </div>
                      <p className={styles.supervisorTarget}>
                        Руководитель: <strong>{app.supervisor?.user.name}</strong>
                      </p>
                      {app.status === "INTERESTED" && app.supervisor?.contact && (
                        <p className={styles.contactRevealed}>
                          Контакт: <strong>{app.supervisor.contact}</strong>
                        </p>
                      )}
                      <p className={styles.motivation}>{app.motivation}</p>
                      {app.comment && <p className={styles.comment}>Комментарий: {app.comment}</p>}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className={styles.date}>{new Date(app.createdAt).toLocaleDateString("ru-RU")}</span>
                        {app.status === "PENDING" && (
                          <button
                            onClick={() => { if (confirm("Отозвать предложение?")) handleAction(app.id, "withdraw"); }}
                            className={styles.rejectButton}
                            style={{ fontSize: 13, padding: "4px 12px" }}
                          >
                            Отозвать
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Вид для НР
  if (role === "SUPERVISOR") {
    const pending = supervisorApps.filter((a) => a.status === "PENDING");
    const resolved = supervisorApps.filter((a) => a.status !== "PENDING");

    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <h1 className={styles.title}>Заявки</h1>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${supTab === "incoming" ? styles.tabActive : ""}`}
              onClick={() => setSupTab("incoming")}
            >
              <span className={styles.tabWithHint}>
                Входящие заявки ({supervisorApps.length})
                <span className={styles.hintIcon}>?<span className={styles.hintTooltip}>Заявки студентов на участие в ваших проектах</span></span>
              </span>
            </button>
            <button
              className={`${styles.tab} ${supTab === "proposals" ? styles.tabActive : ""}`}
              onClick={() => setSupTab("proposals")}
            >
              <span className={styles.tabWithHint}>
                Предложения от студентов ({supervisorProposals.length})
                <span className={styles.hintIcon}>?<span className={styles.hintTooltip}>Студенты предлагают вам стать научным руководителем их проектов</span></span>
              </span>
            </button>
            <button
              className={`${styles.tab} ${supTab === "my" ? styles.tabActive : ""}`}
              onClick={() => setSupTab("my")}
            >
              <span className={styles.tabWithHint}>
                Мои заявки на руководство ({supervisorOwnApps.length})
                <span className={styles.hintIcon}>?<span className={styles.hintTooltip}>Ваши заявки на руководство проектами, которые вы нашли в каталоге</span></span>
              </span>
            </button>
          </div>

          {message && <p className={styles.success}>{message}</p>}

          {supTab === "incoming" && (
            <>
              {pending.length > 0 && (
                <>
                  <h2 className={styles.subtitle}>На рассмотрении ({pending.length})</h2>
                  <div className={styles.list}>
                    {pending.map((app) => renderReviewCard(app))}
                  </div>
                </>
              )}

              {resolved.length > 0 && (
                <>
                  <h2 className={styles.subtitle}>Рассмотренные ({resolved.length})</h2>
                  <div className={styles.list}>
                    {resolved.map((app) => (
                      <div key={app.id} className={`${styles.card} ${styles.cardResolved}`}>
                        <div className={styles.cardHeader}>
                          <span className={styles.studentName}>{app.student?.user.name}</span>
                          <span className={`${styles.status} ${styles[`status_${app.status}`]}`}>
                            {STATUS_LABELS[app.status]}
                          </span>
                        </div>
                        <span className={styles.projectBadge}>{app.project.title}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {supervisorApps.length === 0 && <p className={styles.empty}>Входящих заявок пока нет</p>}
            </>
          )}

          {/* Предложения проектов от студентов (SUPERVISION_REQUEST) */}
          {supTab === "proposals" && (
            <>
              {supervisorProposals.length === 0 ? (
                <p className={styles.empty}>Студенты пока не предлагали вам проекты</p>
              ) : (
                <div className={styles.list}>
                  {supervisorProposals.map((app) => {
                    const isPending = app.status === "PENDING";
                    const isInterested = app.status === "INTERESTED";

                    return (
                      <div key={app.id} className={styles.card}>
                        <div className={styles.cardHeader}>
                          <span className={styles.studentName}>{app.student?.user.name}</span>
                          <span className={`${styles.status} ${styles[`status_${app.status}`]}`}>
                            {STATUS_LABELS[app.status] || app.status}
                          </span>
                        </div>

                        {/* Информация о проекте */}
                        <div className={styles.proposalProject}>
                          <a href={`/projects/${app.project.id}`} className={styles.projectLink}>
                            {app.project.title}
                          </a>
                          {app.project.projectType && (
                            <span className={styles.projectBadge}>
                              {app.project.projectType === "CLASSIC_DISSERTATION" ? "Исследование" :
                               app.project.projectType === "STARTUP" ? "Стартап" : "Корп. стартап"}
                            </span>
                          )}
                          {app.project.direction && (
                            <span className={styles.dirBadge}>{app.project.direction}</span>
                          )}
                        </div>

                        {/* Информация о студенте */}
                        {app.student && (
                          <div className={styles.studentInfo}>
                            <span>{app.student.direction}, {app.student.course} курс</span>
                            {app.student.competencies.length > 0 && (
                              <div className={styles.tags}>
                                {app.student.competencies.slice(0, 5).map((c) => (
                                  <span key={c} className={styles.tag}>{c}</span>
                                ))}
                              </div>
                            )}
                            {app.student.portfolioUrl && (
                              <a href={app.student.portfolioUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>Портфолио</a>
                            )}
                            {/* Контакт показываем только после INTERESTED */}
                            {isInterested && (
                              <span className={styles.contactRevealed}>Контакт: <strong>{app.student.contact}</strong></span>
                            )}
                          </div>
                        )}

                        <p className={styles.motivation}><strong>Сообщение:</strong> {app.motivation}</p>
                        {app.comment && <p className={styles.comment}>Комментарий: {app.comment}</p>}

                        {/* Кнопки действий */}
                        {isPending && (
                          <div className={styles.actionBlock}>
                            <div className={styles.actionButtons}>
                              <button onClick={() => handleAction(app.id, "interested")} className={styles.acceptButton}>
                                Заинтересован
                              </button>
                              {actionId === app.id ? (
                                <>
                                  <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    className={styles.textarea}
                                    placeholder="Укажите причину отказа (желательно)"
                                    rows={2}
                                  />
                                  <button onClick={() => handleAction(app.id, "decline")} className={styles.rejectButton}>Отклонить</button>
                                  <button onClick={() => { setActionId(null); setComment(""); }} className={styles.cancelButton}>Отмена</button>
                                </>
                              ) : (
                                <button onClick={() => setActionId(app.id)} className={styles.rejectButton}>Отклонить</button>
                              )}
                            </div>
                          </div>
                        )}

                        {isInterested && (
                          <div className={styles.actionBlock}>
                            <p className={styles.interestedHint}>Сначала свяжитесь со студентом и проведите встречу. Не подтверждайте руководство до разговора:</p>
                            <div className={styles.actionButtons}>
                              <button onClick={() => handleAction(app.id, "confirm")} className={styles.acceptButton}>
                                Подтвердить руководство
                              </button>
                              {actionId === app.id ? (
                                <>
                                  <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    className={styles.textarea}
                                    placeholder="Укажите причину отказа (желательно)"
                                    rows={2}
                                  />
                                  <button onClick={() => handleAction(app.id, "decline")} className={styles.rejectButton}>Отказаться</button>
                                  <button onClick={() => { setActionId(null); setComment(""); }} className={styles.cancelButton}>Отмена</button>
                                </>
                              ) : (
                                <button onClick={() => setActionId(app.id)} className={styles.rejectButton}>Отказаться</button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {supTab === "my" && (
            <>
              {supervisorOwnApps.length === 0 ? (
                <p className={styles.empty}>Вы ещё не подавали заявок на руководство. <a href="/projects" className={styles.link}>Найти проект</a></p>
              ) : (
                <div className={styles.list}>
                  {supervisorOwnApps.map((app) => (
                    <div key={app.id} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <a href={`/projects/${app.project.id}`} className={styles.projectLink}>{app.project.title}</a>
                        <span className={`${styles.status} ${styles[`status_${app.status}`]}`}>
                          {STATUS_LABELS[app.status]}
                        </span>
                      </div>
                      <p className={styles.motivation}>{app.motivation}</p>
                      {app.comment && <p className={styles.comment}>Комментарий: {app.comment}</p>}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className={styles.date}>{new Date(app.createdAt).toLocaleDateString("ru-RU")}</span>
                        {app.status === "PENDING" && (
                          <button
                            onClick={() => { if (confirm("Отозвать заявку?")) handleAction(app.id, "withdraw"); }}
                            className={styles.rejectButton}
                            style={{ fontSize: 13, padding: "4px 12px" }}
                          >
                            Отозвать
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return <div className={styles.wrapper}><p>Загрузка...</p></div>;

  // Карточка заявки для рассмотрения (автор/НР)
  function renderReviewCard(app: AuthorApplication) {
    const isSupervisorApp = app.type === "SUPERVISOR";
    const applicantName = isSupervisorApp
      ? app.supervisor?.user.name || "Научный руководитель"
      : app.student?.user.name || "Студент";

    return (
      <div key={app.id} className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.studentName}>
            <span style={{ color: isSupervisorApp ? "#003092" : "#E8375A", fontWeight: 600, marginRight: 6 }}>
              {isSupervisorApp ? "[Науч. рук.]" : "[Студент]"}
            </span>
            {isSupervisorApp && app.supervisor?.id
              ? <a href={`/supervisors/${app.supervisor.id}`} className={styles.link}>{applicantName}</a>
              : applicantName
            }
          </span>
          <span className={styles.projectBadge}>{app.project.title}</span>
        </div>

        {/* Инфо о студенте */}
        {!isSupervisorApp && app.student && (
          <div className={styles.studentInfo}>
            <span>{app.student.direction}, {app.student.course} курс</span>
            <span className={styles.contact}>Email: {app.student.user.email}</span>
            {app.student.contact && <span className={styles.contact}>Контакт: {app.student.contact}</span>}
            {app.student.competencies.length > 0 && (
              <div className={styles.tags}>
                {app.student.competencies.slice(0, 5).map((c) => (
                  <span key={c} className={styles.tag}>{c}</span>
                ))}
              </div>
            )}
            {app.student.portfolioUrl && (
              <a href={app.student.portfolioUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>Портфолио</a>
            )}
          </div>
        )}

        {/* Инфо о НР-заявителе */}
        {isSupervisorApp && app.supervisor && (
          <div className={styles.studentInfo}>
            <span>{app.supervisor.position}, {app.supervisor.workplace}</span>
            <span>{app.supervisor.academicDegree}</span>
            {app.supervisor.expertise.length > 0 && (
              <div className={styles.tags}>
                {app.supervisor.expertise.slice(0, 5).map((e) => (
                  <span key={e} className={styles.tag}>{e}</span>
                ))}
              </div>
            )}
            <span className={styles.contact}>Контакт: {app.supervisor.contact}</span>
          </div>
        )}

        {app.role && <p className={styles.roleBadge}>Роль: {app.role}</p>}
        <p className={styles.motivation}><strong>Мотивация:</strong> {app.motivation}</p>

        {actionId === app.id ? (
          <div className={styles.actionBlock}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={styles.textarea}
              placeholder="Комментарий (необязательно)"
              rows={2}
            />
            <div className={styles.actionButtons}>
              <button onClick={() => handleAction(app.id, "accept")} className={styles.acceptButton}>
                {isSupervisorApp ? "Назначить руководителем" : "Принять"}
              </button>
              <button onClick={() => handleAction(app.id, "reject")} className={styles.rejectButton}>Отклонить</button>
              <button onClick={() => { setActionId(null); setComment(""); }} className={styles.cancelButton}>Отмена</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setActionId(app.id)} className={styles.reviewButton}>Рассмотреть</button>
        )}
      </div>
    );
  }
}
