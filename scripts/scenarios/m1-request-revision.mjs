// M1: модератор возвращает запрос на доработку, студент исправляет и отправляет снова.
// Комментарий при одобрении по желанию и адресован студенту.
// Источник: specs/08-FR-08-requirements-v2.md (M1)
//
// Запуск: node --env-file=.env scripts/scenarios/m1-request-revision.mjs
// Созданные запросы и уведомления удаляются в конце, доступ потоков восстанавливается.

import { PrismaClient } from "@prisma/client";
import { login, suite } from "./lib.mjs";

const STUDENT = "test.student.open@test.local"; // Поток2025, труба открыта
const OTHER_STUDENT = "test.student.locked@test.local"; // Поток2026 — трубу откроем на время
const EXPERT = "external.expert@test.local";
const OTHER_COHORT = "Поток2026";

const T = suite("M1: возврат на доработку и комментарий модератора");
const prisma = new PrismaClient();
const startedAt = new Date();

const admin = await login("test.admin@test.local");
const student = await login(STUDENT);
const otherStudent = await login(OTHER_STUDENT);
const expert = await login(EXPERT);

const expertCard = await prisma.expertProfile.findFirst({
  where: { user: { email: EXPERT } },
  select: { id: true },
});
const initialAccess = (await admin.json("/api/expert/admin/access")).body.cohorts.find((r) => r.cohort === OTHER_COHORT);

const form = (mark) => ({
  topic: `${mark} Хочу обсудить выбор метода для сопоставления схем табличных данных. `.repeat(8),
  expectedResult: `${mark} Выбрать метод и понять, как проверить гипотезу на наших данных.`.padEnd(100, "."),
  ownProgress: `${mark} Прочитал обзоры, попробовал два подхода на небольшой выборке, оба дали слабый результат. `.repeat(6),
  problemArea: "",
  materialsUrl: "https://example.com/folder",
});

const moderate = (id, action, comment) =>
  admin.send("POST", `/api/expert/admin/requests/${id}/moderate`, { action, comment });
const myRequest = async (id) => (await student.json("/api/expert/requests")).body.find((r) => r.id === id);
const createdIds = [];

try {
  await admin.send("PUT", "/api/expert/admin/access", { cohort: OTHER_COHORT, isOpen: true });

  T.section("Возврат на доработку");
  const created = await student.send("POST", "/api/expert/requests", { expertId: expertCard.id, ...form("v1") });
  T.check("студент отправил запрос", created.status === 201, `статус ${created.status} ${created.body?.error || ""}`);
  const id = created.body.id;
  createdIds.push(id);

  T.check("вернуть без комментария → 400", (await moderate(id, "return", "")).status === 400);
  T.check("отклонить без комментария → 400", (await moderate(id, "reject", "  ")).status === 400);
  T.check("студент не может модерировать → 403", (await student.send("POST", `/api/expert/admin/requests/${id}/moderate`, { action: "return", comment: "x" })).status === 403);
  T.check("неизвестное действие → 400", (await moderate(id, "archive", "x")).status === 400);

  const COMMENT = "Уточните, какой результат нужен от встречи и на каких данных проверяли подходы.";
  const ret = await moderate(id, "return", COMMENT);
  T.check("модератор вернул с комментарием", ret.status === 200 && ret.body.status === "NEEDS_REVISION", `статус ${ret.status}`);
  T.check("повторное решение по запросу на доработке → 409", (await moderate(id, "approve", "")).status === 409);

  const mine = await myRequest(id);
  T.check("студент видит статус «На доработке» и комментарий", mine?.status === "NEEDS_REVISION" && mine?.moderatorComment === COMMENT);
  const notes = (await student.json("/api/notifications?space=expert&limit=50")).body.notifications;
  T.check("студенту пришло уведомление в пространстве трубы", notes.some((n) => n.type === "EXPERT_REQUEST_RETURNED" && n.message === COMMENT));
  const vkrNotes = (await student.json("/api/notifications?space=vkr&limit=50")).body.notifications;
  T.check("в платформенные уведомления возврат не попал", !vkrNotes.some((n) => n.type === "EXPERT_REQUEST_RETURNED"));

  const inbox = (await expert.json("/api/expert/requests")).body;
  T.check("эксперт не видит запрос на доработке", Array.isArray(inbox) && !inbox.some((r) => r.id === id));
  T.check("эксперт не может принять запрос на доработке", (await expert.send("POST", `/api/expert/requests/${id}/decision`, { action: "accept" })).status === 409);

  const dup = await student.send("POST", "/api/expert/requests", { expertId: expertCard.id, ...form("dup") });
  T.check("второй запрос тому же эксперту → 409 с подсказкой исправить", dup.status === 409 && dup.body.error.includes("доработку"), `статус ${dup.status}`);

  T.section("Страница исправления");
  const edit = await student.page(`/expert/requests/${id}/edit`);
  T.check("страница открывается с комментарием и заполненной анкетой", edit.status === 200 && edit.html.includes("Исправление запроса") && edit.html.includes("Уточните, какой результат нужен") && edit.html.includes("v1 Хочу обсудить"));
  const otherEdit = await otherStudent.page(`/expert/requests/${id}/edit`);
  T.check("чужой запрос — уводит к своим запросам", otherEdit.status === 307 && otherEdit.location?.endsWith("/expert/my-requests"), `статус ${otherEdit.status} → ${otherEdit.location}`);

  T.section("Повторная отправка");
  T.check("чужой студент не может исправить → 404", (await otherStudent.send("PATCH", `/api/expert/requests/${id}`, form("чужой"))).status === 404);
  T.check("эксперт не может исправить → 403", (await expert.send("PATCH", `/api/expert/requests/${id}`, form("эксперт"))).status === 403);
  const short = await student.send("PATCH", `/api/expert/requests/${id}`, { ...form("v2"), topic: "коротко" });
  T.check("короткая анкета → 400, запрос остаётся на доработке", short.status === 400 && (await myRequest(id)).status === "NEEDS_REVISION");
  const resub = await student.send("PATCH", `/api/expert/requests/${id}`, form("v2"));
  T.check("исправленный запрос отправлен → снова NEW", resub.status === 200 && resub.body.status === "NEW", `статус ${resub.status} ${resub.body?.error || ""}`);
  const afterResub = await myRequest(id);
  T.check("анкета обновилась", afterResub.topic.startsWith("v2 "));
  T.check("повторно исправить отправленный запрос → 409", (await student.send("PATCH", `/api/expert/requests/${id}`, form("v3"))).status === 409);
  const editAgain = await student.page(`/expert/requests/${id}/edit`);
  T.check("страница исправления для запроса не на доработке уводит к списку", editAgain.status === 307);

  const queue = (await admin.json("/api/expert/admin/requests?status=NEW")).body.requests;
  const inQueue = queue.find((r) => r.id === id);
  T.check("запрос вернулся в очередь «Новые» с прошлым комментарием", inQueue?.moderatorComment === COMMENT);
  const adminNotes = (await admin.json("/api/notifications?space=expert&limit=50")).body.notifications;
  T.check("модератору пришло «Запрос исправлен после доработки»", adminNotes.some((n) => n.title === "Запрос исправлен после доработки"));
  T.check("эксперт по-прежнему не видит запрос до одобрения", !(await expert.json("/api/expert/requests")).body.some((r) => r.id === id));

  T.section("Одобрение с комментарием студенту");
  const APPROVE_NOTE = "Хорошо сформулировано, эксперт ответит в течение недели.";
  const appr = await moderate(id, "approve", APPROVE_NOTE);
  T.check("одобрено с комментарием", appr.status === 200 && appr.body.status === "APPROVED_BY_MODERATOR");
  const approved = await myRequest(id);
  T.check("студент видит комментарий при одобрении", approved.status === "APPROVED_BY_MODERATOR" && approved.moderatorComment === APPROVE_NOTE);
  const inboxAfter = (await expert.json("/api/expert/requests")).body;
  const forExpert = inboxAfter.find((r) => r.id === id);
  T.check("эксперт видит запрос после одобрения", Boolean(forExpert));
  T.check("эксперту комментарий модератора не отдаётся", forExpert && !("moderatorComment" in forExpert));

  T.section("Одобрение без комментария после возврата");
  const second = await student.send("POST", "/api/expert/requests", { expertId: (await prisma.expertProfile.findFirst({ where: { user: { email: "cat.visible@test.local" } }, select: { id: true } })).id, ...form("s2") });
  if (second.status === 201) createdIds.push(second.body.id);
  T.check("второй запрос другому эксперту отправлен", second.status === 201, `статус ${second.status} ${second.body?.error || ""}`);
  if (second.status === 201) {
    await moderate(second.body.id, "return", "Добавьте ссылку на материалы.");
    await student.send("PATCH", `/api/expert/requests/${second.body.id}`, form("s2v2"));
    await moderate(second.body.id, "approve", "");
    const s2 = await myRequest(second.body.id);
    T.check("одобрение без комментария стирает комментарий прошлого возврата", s2.status === "APPROVED_BY_MODERATOR" && s2.moderatorComment === null);
  }

  T.section("Метрики");
  const metrics = await admin.json("/api/expert/admin/metrics");
  T.check("метрики отвечают с новым статусом в базе", metrics.status === 200);
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
