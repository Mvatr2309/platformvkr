// M1: модератор возвращает запрос на доработку, студент исправляет и отправляет снова.
// Комментарий при одобрении по желанию и адресован студенту. Решение модератора атомарно.
// Источник: specs/08-FR-08-requirements-v2.md (M1), specs/08-FR-08-expert-pipeline.md (раздел 6)
//
// Запуск: node --env-file=.env scripts/scenarios/m1-request-revision.mjs
// Созданные запросы и уведомления удаляются в конце; доступ потоков, карточка эксперта
// и программа тестового студента восстанавливаются.

import { PrismaClient } from "@prisma/client";
import { login, suite, visibleHtml } from "./lib.mjs";

const STUDENT = "test.student.open@test.local"; // Поток2025, труба открыта
const OTHER_STUDENT = "test.student.locked@test.local"; // Поток2026 — трубу откроем на время
const EXPERT = "external.expert@test.local";
const EXPERT2 = "cat.visible@test.local";
const OTHER_COHORT = "Поток2026";

const T = suite("M1: возврат на доработку и комментарий модератора");
const prisma = new PrismaClient();
const startedAt = new Date();

const admin = await login("test.admin@test.local");
const student = await login(STUDENT);
const otherStudent = await login(OTHER_STUDENT);
const expert = await login(EXPERT);
const expert2 = await login(EXPERT2);

const cardOf = (email) => prisma.expertProfile.findFirst({ where: { user: { email } }, select: { id: true } });
const expertCard = await cardOf(EXPERT);
const expert2Card = await cardOf(EXPERT2);
const initialAccess = (await admin.json("/api/expert/admin/access")).body.cohorts.find((r) => r.cohort === OTHER_COHORT);
const otherProfile = await prisma.studentProfile.findFirst({
  where: { user: { email: OTHER_STUDENT } },
  select: { id: true, direction: true },
});
const foreignProject = await prisma.project.findFirst({
  where: { members: { none: { studentId: otherProfile.id } } },
  select: { id: true },
});

const form = (mark) => ({
  topic: `${mark} Хочу обсудить выбор метода для сопоставления схем табличных данных. `.repeat(8),
  expectedResult: `${mark} Выбрать метод и понять, как проверить гипотезу на наших данных.`.padEnd(100, "."),
  ownProgress: `${mark} Прочитал обзоры, попробовал два подхода на небольшой выборке, оба дали слабый результат. `.repeat(6),
  problemArea: "",
  materialsUrl: "https://example.com/folder",
});

const moderate = (id, action, comment, updatedAt) =>
  admin.send("POST", `/api/expert/admin/requests/${id}/moderate`, { action, comment, updatedAt });
const queueCard = async (id) =>
  (await admin.json("/api/expert/admin/requests?status=ALL")).body.requests.find((r) => r.id === id);
const requestOf = async (client, id) => (await client.json("/api/expert/requests")).body.find((r) => r.id === id);
const createdIds = [];
const create = async (client, expertId, mark) => {
  const r = await client.send("POST", "/api/expert/requests", { expertId, ...form(mark) });
  if (r.status === 201) createdIds.push(r.body.id);
  return r;
};

try {
  await admin.send("PUT", "/api/expert/admin/access", { cohort: OTHER_COHORT, isOpen: true });

  T.section("Возврат на доработку");
  const created = await create(student, expertCard.id, "v1");
  T.check("студент отправил запрос", created.status === 201, `статус ${created.status} ${created.body?.error || ""}`);
  const id = created.body.id;

  const noComment = await moderate(id, "return", "");
  T.check("вернуть без комментария → 400 с подсказкой", noComment.status === 400 && noComment.body.error.includes("студент увидит, что исправить"));
  const noReason = await moderate(id, "reject", "  ");
  T.check("отклонить без комментария → 400 с подсказкой", noReason.status === 400 && noReason.body.error.includes("Причина отклонения обязательна"));
  T.check("студент не может модерировать → 403", (await student.send("POST", `/api/expert/admin/requests/${id}/moderate`, { action: "return", comment: "x" })).status === 403);
  const unknown = await moderate(id, "archive", "x");
  T.check("неизвестное действие → 400 «Неизвестное действие»", unknown.status === 400 && unknown.body.error === "Неизвестное действие");

  const COMMENT = "Уточните, какой результат нужен от встречи и на каких данных проверяли подходы.";
  const ret = await moderate(id, "return", COMMENT, (await queueCard(id)).updatedAt);
  T.check("модератор вернул с комментарием", ret.status === 200 && ret.body.status === "NEEDS_REVISION", `статус ${ret.status}`);
  T.check("одобрить запрос на доработке → 409", (await moderate(id, "approve", "")).status === 409);

  const mine = await requestOf(student, id);
  T.check("студент видит статус «На доработке» и комментарий", mine?.status === "NEEDS_REVISION" && mine?.moderatorComment === COMMENT);
  const notes = (await student.json("/api/notifications?space=expert&limit=50")).body.notifications;
  T.check("студенту пришло уведомление в пространстве трубы", notes.some((n) => n.type === "EXPERT_REQUEST_RETURNED" && n.message === COMMENT));
  const vkrNotes = (await student.json("/api/notifications?space=vkr&limit=50")).body.notifications;
  T.check("в платформенные уведомления возврат не попал", !vkrNotes.some((n) => n.type === "EXPERT_REQUEST_RETURNED"));

  const metrics = (await admin.json("/api/expert/admin/metrics")).body;
  T.check("метрики считают запрос на доработке", metrics.statusCounts?.NEEDS_REVISION >= 1, JSON.stringify(metrics.statusCounts));

  const inbox = (await expert.json("/api/expert/requests")).body;
  T.check("эксперт не видит запрос на доработке", Array.isArray(inbox) && !inbox.some((r) => r.id === id));
  T.check("эксперт не может принять запрос на доработке", (await expert.send("POST", `/api/expert/requests/${id}/decision`, { action: "accept" })).status === 409);

  const dup = await create(student, expertCard.id, "dup");
  T.check("второй запрос тому же эксперту → 409 с подсказкой исправить", dup.status === 409 && dup.body.error.includes("доработку"), `статус ${dup.status}`);

  T.section("Страница исправления");
  const edit = await student.page(`/expert/requests/${id}/edit`);
  const editView = visibleHtml(edit.html);
  T.check("на экране заголовок «Исправление запроса»", edit.status === 200 && editView.includes("Исправление запроса"));
  T.check("на экране комментарий модератора", editView.includes("Уточните, какой результат нужен"));
  T.check("на экране анкета заполнена текущими ответами", /<textarea[^>]*>v1 Хочу обсудить/.test(editView));
  const otherEdit = await otherStudent.page(`/expert/requests/${id}/edit`);
  T.check("чужой запрос — уводит к своим запросам", otherEdit.status === 307 && otherEdit.location?.endsWith("/expert/my-requests"), `статус ${otherEdit.status} → ${otherEdit.location}`);

  T.section("Повторная отправка");
  T.check("чужой студент не может исправить → 404", (await otherStudent.send("PATCH", `/api/expert/requests/${id}`, form("чужой"))).status === 404);
  T.check("эксперт не может исправить → 403", (await expert.send("PATCH", `/api/expert/requests/${id}`, form("эксперт"))).status === 403);
  const short = await student.send("PATCH", `/api/expert/requests/${id}`, { ...form("v2"), topic: "коротко" });
  T.check("короткая анкета → 400, запрос остаётся на доработке", short.status === 400 && (await requestOf(student, id)).status === "NEEDS_REVISION");
  const resub = await student.send("PATCH", `/api/expert/requests/${id}`, form("v2"));
  T.check("исправленный запрос отправлен → снова NEW", resub.status === 200 && resub.body.status === "NEW", `статус ${resub.status} ${resub.body?.error || ""}`);
  T.check("анкета обновилась", (await requestOf(student, id)).topic.startsWith("v2 "));
  T.check("повторно исправить отправленный запрос → 409", (await student.send("PATCH", `/api/expert/requests/${id}`, form("v3"))).status === 409);
  const editAgain = await student.page(`/expert/requests/${id}/edit`);
  T.check("страница исправления для запроса не на доработке уводит к списку", editAgain.status === 307 && editAgain.location?.endsWith("/expert/my-requests"), `→ ${editAgain.location}`);

  const inQueue = (await admin.json("/api/expert/admin/requests?status=NEW")).body.requests.find((r) => r.id === id);
  T.check("запрос вернулся в очередь «Новые» с прошлым комментарием", inQueue?.moderatorComment === COMMENT);
  const adminNotes = (await admin.json("/api/notifications?space=expert&limit=50")).body.notifications;
  T.check("модератору пришло «Запрос исправлен после доработки»", adminNotes.some((n) => n.title === "Запрос исправлен после доработки"));
  T.check("эксперт по-прежнему не видит запрос до одобрения", !(await expert.json("/api/expert/requests")).body.some((r) => r.id === id));

  T.section("Одобрение с комментарием студенту");
  const APPROVE_NOTE = "Хорошо сформулировано, эксперт ответит в течение недели.";
  const appr = await moderate(id, "approve", APPROVE_NOTE, inQueue.updatedAt);
  T.check("одобрено с комментарием", appr.status === 200 && appr.body.status === "APPROVED_BY_MODERATOR");
  const approved = await requestOf(student, id);
  T.check("студент видит комментарий при одобрении", approved.status === "APPROVED_BY_MODERATOR" && approved.moderatorComment === APPROVE_NOTE);
  const forExpert = (await expert.json("/api/expert/requests")).body.find((r) => r.id === id);
  T.check("эксперт видит запрос после одобрения", Boolean(forExpert));
  T.check("эксперту комментарий модератора не отдаётся", forExpert && !("moderatorComment" in forExpert));

  T.section("Одобрение без комментария после возврата");
  const second = await create(student, expert2Card.id, "s2");
  T.check("второй запрос другому эксперту отправлен", second.status === 201, `статус ${second.status} ${second.body?.error || ""}`);
  const s2id = second.body.id;
  const s2ret = await moderate(s2id, "return", "Добавьте ссылку на материалы.");
  T.check("возврат второго запроса", s2ret.status === 200 && (await requestOf(student, s2id)).moderatorComment === "Добавьте ссылку на материалы.");
  const s2resub = await student.send("PATCH", `/api/expert/requests/${s2id}`, form("s2v2"));
  T.check("повторная отправка второго запроса", s2resub.status === 200 && (await requestOf(student, s2id)).moderatorComment === "Добавьте ссылку на материалы.");
  await moderate(s2id, "approve", "");
  const s2 = await requestOf(student, s2id);
  T.check("одобрение без комментария стирает комментарий прошлого возврата", s2.status === "APPROVED_BY_MODERATOR" && s2.moderatorComment === null);

  T.section("Отклонение модератором");
  const third = await create(otherStudent, expertCard.id, "r1");
  T.check("запрос другого студента отправлен", third.status === 201, `статус ${third.status} ${third.body?.error || ""}`);
  const rid = third.body.id;
  const REASON = "Вопрос не относится к экспертизе, обратитесь к научному руководителю.";
  const rej = await moderate(rid, "reject", REASON);
  T.check("отклонение с причиной → REJECTED_BY_MODERATOR", rej.status === 200 && rej.body.status === "REJECTED_BY_MODERATOR");
  T.check("студент видит причину отклонения", (await requestOf(otherStudent, rid)).moderatorComment === REASON);
  const rNotes = (await otherStudent.json("/api/notifications?space=expert&limit=50")).body.notifications;
  T.check("уведомление об отклонении — в пространстве трубы", rNotes.some((n) => n.type === "EXPERT_REQUEST_REJECTED" && n.message === REASON));
  T.check("эксперт отклонённый модератором запрос не видит", !(await expert.json("/api/expert/requests")).body.some((r) => r.id === rid));

  T.section("Атомарность: устаревшая карточка у модератора");
  const fourth = await create(otherStudent, expert2Card.id, "a1");
  const aid = fourth.body.id;
  const v0 = (await queueCard(aid)).updatedAt;
  T.check("возврат с актуальной версией", (await moderate(aid, "return", "Уточните данные.", v0)).status === 200);
  await otherStudent.send("PATCH", `/api/expert/requests/${aid}`, form("a2"));
  const stale = await moderate(aid, "approve", "", v0);
  T.check("одобрение по устаревшей версии → 409 «обновите очередь»", stale.status === 409 && stale.body.error.includes("обновите очередь"));
  T.check("запрос остался NEW, эксперт его не видит", (await requestOf(otherStudent, aid)).status === "NEW" && !(await expert2.json("/api/expert/requests")).body.some((r) => r.id === aid));
  const v1 = (await queueCard(aid)).updatedAt;
  T.check("снова вернуть с актуальной версией", (await moderate(aid, "return", "Всё ещё нужно уточнить данные.", v1)).status === 200);

  T.section("Ветки повторной отправки");
  await admin.send("PUT", "/api/expert/admin/access", { cohort: OTHER_COHORT, isOpen: false });
  const closed = await otherStudent.send("PATCH", `/api/expert/requests/${aid}`, form("a3"));
  T.check("труба закрыта потоку → 403, запрос остаётся на доработке", closed.status === 403 && (await queueCard(aid)).status === "NEEDS_REVISION");
  await admin.send("PUT", "/api/expert/admin/access", { cohort: OTHER_COHORT, isOpen: true });

  await prisma.expertProfile.update({ where: { id: expert2Card.id }, data: { hiddenByOwner: true } });
  try {
    const hiddenEdit = visibleHtml((await otherStudent.page(`/expert/requests/${aid}/edit`)).html);
    T.check("эксперт скрыл карточку — страница объясняет вместо анкеты", hiddenEdit.includes("Эксперт сейчас не принимает запросы") && !hiddenEdit.includes("Исправление запроса"));
    const hidden = await otherStudent.send("PATCH", `/api/expert/requests/${aid}`, form("a3"));
    T.check("эксперт скрыл карточку — PATCH 409 «не принимает запросы»", hidden.status === 409 && hidden.body.error.includes("не принимает запросы"));
  } finally {
    await prisma.expertProfile.update({ where: { id: expert2Card.id }, data: { hiddenByOwner: false } });
  }

  await prisma.studentProfile.update({ where: { id: otherProfile.id }, data: { direction: "A1-M1-сценарий" } });
  try {
    const branches = await otherStudent.send("PATCH", `/api/expert/requests/${aid}`, {
      ...form("a4"),
      projectId: foreignProject?.id,
      expertId: expertCard.id,
    });
    T.check("повторная отправка прошла", branches.status === 200);
    const after = await prisma.expertRequest.findUnique({ where: { id: aid }, select: { directionSnapshot: true, projectId: true, expertId: true } });
    T.check("снимок программы обновился на момент повторной отправки", after.directionSnapshot === "A1-M1-сценарий");
    T.check("чужой проект молча отброшен", after.projectId === null);
    T.check("эксперт в запросе не подменяется", after.expertId === expert2Card.id);
  } finally {
    await prisma.studentProfile.update({ where: { id: otherProfile.id }, data: { direction: otherProfile.direction } });
  }

  const v2 = (await queueCard(aid)).updatedAt;
  await moderate(aid, "return", "Последний раз уточните.", v2);
  const fromRevision = await moderate(aid, "reject", "Запрос давно не исправлен.");
  T.check("модератор отклоняет запрос на доработке", fromRevision.status === 200 && fromRevision.body.status === "REJECTED_BY_MODERATOR");
} finally {
  await prisma.expertRequest.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.notification.deleteMany({
    where: {
      createdAt: { gte: startedAt },
      type: { in: ["EXPERT_REQUEST_NEW", "EXPERT_REQUEST_RETURNED", "EXPERT_REQUEST_APPROVED", "EXPERT_REQUEST_REJECTED"] },
    },
  });
  if (initialAccess) {
    await admin.send("PUT", "/api/expert/admin/access", { cohort: OTHER_COHORT, isOpen: initialAccess.isOpen });
  }
  await prisma.$disconnect();
}

T.done();
