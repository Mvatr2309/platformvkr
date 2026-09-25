// Утечки, найденные проверкой A1 субагентами (записи #48, #52):
// черновики проектов без входа, внешний эксперт в API платформы, ?secret=admin в рассылке.
//
// Запуск: node --env-file=.env scripts/scenarios/security-legacy.mjs
// Рассылку напоминаний вызываем только со сдвигом на 100 000 дней назад: если защита
// вдруг не сработает, дедлайнов на такую дату нет и ни одно письмо не уйдёт.

import { login, anon, suite } from "./lib.mjs";

const T = suite("Утечки легаси: черновики, внешний эксперт, рассылка");

const admin = await login("test.admin@test.local");
const supervisor = await login("test.supervisor@test.local");
const student = await login("test.student.open@test.local");
const expert = await login("external.expert@test.local");
const guest = anon();

const SAFE_REMINDERS = { daysAhead: -100000 };
const EXPERT_DENIED = "Платформа ВКР недоступна внешним экспертам";

T.section("Каталог проектов: статус выбирает только админ");
const adminDrafts = (await admin.json("/api/projects?status=DRAFT")).body;
T.check("админ получает черновики по ?status=DRAFT", Array.isArray(adminDrafts) && adminDrafts.length > 0 && adminDrafts.every((p) => p.status === "DRAFT"));
const draftId = adminDrafts[0]?.id;
for (const [label, client] of [["гость", guest], ["научник", supervisor], ["студент", student]]) {
  for (const status of ["DRAFT", "PENDING"]) {
    const r = await client.json(`/api/projects?status=${status}`);
    T.check(`${label}: ?status=${status} отдаёт только открытые`, r.status === 200 && r.body.every((p) => p.status === "OPEN") && !r.body.some((p) => p.id === draftId), `статус ${r.status}`);
  }
}
const bogus = await guest.json("/api/projects?status=REJECTED");
T.check("несуществующий статус больше не роняет ручку (было 500)", bogus.status === 200 && bogus.body.every((p) => p.status === "OPEN"));
const adminBogus = await admin.json("/api/projects?status=MODERATION");
T.check("у админа несуществующий статус → открытые, без 500", adminBogus.status === 200 && adminBogus.body.every((p) => p.status === "OPEN"));
const mine = await supervisor.json("/api/projects?my=true");
T.check("научник: свои проекты любых статусов не затронуты", mine.status === 200);

T.section("Лента проекта");
const openWithFeed = (await guest.json("/api/projects")).body.map((p) => p.id);
let openFeedOk = false;
for (const id of openWithFeed.slice(0, 40)) {
  const r = await guest.json(`/api/projects/${id}/activities`);
  if (r.status === 200 && r.body.length > 0) { openFeedOk = true; break; }
}
T.check("гость: лента открытого проекта публична, как раньше", openFeedOk);
T.check("гость: лента черновика → 404", (await guest.json(`/api/projects/${draftId}/activities`)).status === 404);
T.check("посторонний студент: лента черновика → 404", (await student.json(`/api/projects/${draftId}/activities`)).status === 404);
T.check("посторонний научник: лента черновика → 404", (await supervisor.json(`/api/projects/${draftId}/activities`)).status === 404);
T.check("админ: лента черновика → 200", (await admin.json(`/api/projects/${draftId}/activities`)).status === 200);
T.check("несуществующий проект → 404", (await guest.json("/api/projects/nonexistent/activities")).status === 404);

T.section("Внешний эксперт не ходит в API платформы");
const adminKnowledge = (await admin.json("/api/knowledge")).body;
const articleId = adminKnowledge?.[0]?.id;
const expertReads = [
  "/api/knowledge",
  `/api/knowledge/${articleId || "nonexistent"}`,
  `/api/knowledge/${articleId || "nonexistent"}/files/nonexistent/download`,
  "/api/events",
  "/api/events/ical",
  "/api/projects",
  "/api/projects?status=DRAFT",
  `/api/projects/${draftId}`,
  `/api/projects/${draftId}/activities`,
  "/api/supervisors",
  "/api/applications",
];
for (const path of expertReads) {
  const r = await expert.json(path);
  T.check(`эксперт: GET ${path} → 403`, r.status === 403 && r.body?.error === EXPERT_DENIED, `статус ${r.status}`);
}
T.check("эксперт: входящие трубы работают", (await expert.json("/api/expert/requests")).status === 200);
T.check("эксперт: карточка работает", (await expert.json("/api/expert/profile")).status === 200);
T.check("эксперт: уведомления трубы работают", (await expert.json("/api/notifications?space=expert")).status === 200);
T.check("эксперт: справочники работают", (await expert.json("/api/dictionaries")).status === 200);

T.section("База знаний у остальных ролей не изменилась");
const supKnowledge = (await supervisor.json("/api/knowledge")).body;
const studentKnowledge = (await student.json("/api/knowledge")).body;
T.check("админ видит всё", Array.isArray(adminKnowledge) && adminKnowledge.length >= supKnowledge.length);
T.check("научник видит только материалы для НР", Array.isArray(supKnowledge) && supKnowledge.every((a) => a.visibleToSupervisors));
T.check("студент видит только материалы для студентов", Array.isArray(studentKnowledge) && studentKnowledge.every((a) => a.visibleToStudents));

T.section("Рассылка напоминаний");
const post = (client, q) => client.send("POST", `/api/events/reminders${q}`, SAFE_REMINDERS);
T.check("гость с ?secret=admin → 403", (await post(guest, "?secret=admin")).status === 403);
T.check("гость с пустым ?secret= → 403", (await post(guest, "?secret=")).status === 403);
T.check("гость без секрета → 403", (await post(guest, "")).status === 403);
T.check("студент с ?secret=admin → 403", (await post(student, "?secret=admin")).status === 403);
const adminRun = await post(admin, "");
T.check("админ по сессии → 200 (на пустую дату, писем 0)", adminRun.status === 200 && adminRun.body?.emailsSent === 0, `статус ${adminRun.status} ${JSON.stringify(adminRun.body)}`);

T.done();
