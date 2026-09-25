// Утечки, найденные проверками субагентами (записи #48, #52, #53):
// черновики проектов, лента проекта, внешний эксперт в API платформы, рассылка напоминаний.
//
// Запуск: node --env-file=.env scripts/scenarios/security-legacy.mjs
// Ветка «верный секрет» рассылки проверяется, только если приложение и сценарий запущены
// с одинаковым CRON_SECRET (например, CRON_SECRET=local-scenario-secret в обоих) — иначе
// она явно помечается пропущенной.
// Рассылку вызываем только со сдвигом на 100 000 дней назад: если защита не сработает,
// дедлайнов на такую дату нет и ни одно письмо не уйдёт.
// Временный проект-черновик и уведомления удаляются в конце.

import { PrismaClient } from "@prisma/client";
import { login, anon, suite } from "./lib.mjs";

const T = suite("Утечки легаси: черновики, лента, внешний эксперт, рассылка");
const prisma = new PrismaClient();

const admin = await login("test.admin@test.local");
const supervisor = await login("test.supervisor@test.local");
const student = await login("test.student.open@test.local");
const outsider = await login("test.student.locked@test.local"); // платформа ему открыта, в проекте не состоит
const expert = await login("external.expert@test.local");
const guest = anon();

const SAFE_REMINDERS = { daysAhead: -100000 };
const EXPERT_DENIED = "Платформа ВКР недоступна внешним экспертам";
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Временный черновик: студент — автор, научник — руководитель
const studentProfile = await prisma.studentProfile.findFirst({ where: { user: { email: "test.student.open@test.local" } }, select: { id: true } });
const supervisorProfile = await prisma.supervisorProfile.findFirst({ where: { user: { email: "test.supervisor@test.local" } }, select: { id: true } });
const draft = await prisma.project.create({
  data: {
    title: "Сценарий утечек: временный черновик",
    description: "Создан scripts/scenarios/security-legacy.mjs и удаляется в конце.",
    projectType: "CLASSIC_DISSERTATION",
    status: "DRAFT",
    contact: "scenario@test.local",
    supervisorId: supervisorProfile.id,
    members: { create: { studentId: studentProfile.id, isCreator: true } },
  },
  select: { id: true },
});
// Посторонний студент должен дойти до проверок ленты, а не упереться в гейт A1
const accessBefore = (await admin.json("/api/expert/admin/access")).body.cohorts.find((r) => r.cohort === "Поток2026");
await admin.send("PUT", "/api/expert/admin/access", { cohort: "Поток2026", platformOpen: true });
const expertUserId = (await prisma.user.findUnique({ where: { email: "external.expert@test.local" }, select: { id: true } })).id;
const notes = [];

try {
  T.section("Каталог проектов: статус выбирает только админ");
  const adminDrafts = (await admin.json("/api/projects?status=DRAFT")).body;
  T.check("админ получает черновики по ?status=DRAFT, включая временный", adminDrafts.some((p) => p.id === draft.id) && adminDrafts.every((p) => p.status === "DRAFT"));
  for (const [label, client] of [["гость", guest], ["научник", supervisor], ["студент", student]]) {
    for (const status of ["DRAFT", "PENDING"]) {
      const r = await client.json(`/api/projects?status=${status}`);
      T.check(`${label}: ?status=${status} отдаёт только открытые`, r.status === 200 && r.body.length > 0 && r.body.every((p) => p.status === "OPEN") && !r.body.some((p) => p.id === draft.id), `статус ${r.status}`);
    }
  }
  const bogus = await guest.json("/api/projects?status=REJECTED");
  T.check("несуществующий статус больше не роняет ручку (было 500)", bogus.status === 200 && bogus.body.length > 0 && bogus.body.every((p) => p.status === "OPEN"));
  const adminBogus = await admin.json("/api/projects?status=MODERATION");
  T.check("у админа несуществующий статус → открытые, без 500", adminBogus.status === 200 && adminBogus.body.length > 0 && adminBogus.body.every((p) => p.status === "OPEN"));
  const mineStudent = (await student.json("/api/projects?my=true")).body;
  T.check("студент: в своих проектах есть его черновик", mineStudent.some((p) => p.id === draft.id && p.status === "DRAFT"));
  const mineSupervisor = (await supervisor.json("/api/projects?my=true")).body;
  T.check("научник: в своих проектах есть черновик, где он руководитель", mineSupervisor.some((p) => p.id === draft.id && p.status === "DRAFT"));

  T.section("Лента проекта: только после входа, неоткрытый — только своим");
  const openId = (await guest.json("/api/projects")).body[0].id;
  T.check("гость: лента открытого проекта → 401", (await guest.json(`/api/projects/${openId}/activities`)).status === 401);
  const openFeed = await outsider.json(`/api/projects/${openId}/activities`);
  T.check("вошедший: лента открытого проекта → 200", openFeed.status === 200 && Array.isArray(openFeed.body));
  T.check("гость: лента черновика → 401", (await guest.json(`/api/projects/${draft.id}/activities`)).status === 401);
  T.check("посторонний студент: лента черновика → 404", (await outsider.json(`/api/projects/${draft.id}/activities`)).status === 404);
  const author = await student.json(`/api/projects/${draft.id}/activities`);
  T.check("автор-участник: лента черновика → 200", author.status === 200 && Array.isArray(author.body));
  T.check("научник проекта: лента черновика → 200", (await supervisor.json(`/api/projects/${draft.id}/activities`)).status === 200);
  T.check("админ: лента черновика → 200", (await admin.json(`/api/projects/${draft.id}/activities`)).status === 200);
  T.check("несуществующий проект → 404", (await student.json("/api/projects/nonexistent/activities")).status === 404);

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
    `/api/projects/${draft.id}`,
    `/api/projects/${draft.id}/activities`,
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

  T.section("Уведомления платформы у внешнего эксперта — только ответы поддержки");
  const mk = (data) => prisma.notification.create({ data: { userId: expertUserId, read: false, message: "Сценарий утечек", ...data } }).then((n) => (notes.push(n.id), n));
  const deadline = await mk({ type: "DEADLINE_REMINDER", title: "Сценарий: дедлайн", link: "/calendar" });
  const support = await mk({ type: "SYSTEM", title: "Сценарий: ответ поддержки", link: "/inquiries" });
  const vkr = (await expert.json("/api/notifications?space=vkr&limit=100")).body;
  T.check("эксперту дедлайн платформы не отдаётся", !vkr.notifications.some((n) => n.id === deadline.id));
  T.check("ответ поддержки эксперту виден", vkr.notifications.some((n) => n.id === support.id));

  T.section("База знаний у остальных ролей — ровно по флажкам видимости");
  const ids = (list) => (Array.isArray(list) ? list.map((a) => a.id) : []);
  const expected = async (extra) => (await prisma.article.findMany({ where: { parentId: null, ...extra }, select: { id: true } })).map((a) => a.id);
  const supKnowledge = (await supervisor.json("/api/knowledge")).body;
  const studentKnowledge = (await student.json("/api/knowledge")).body;
  const expAdmin = await expected({});
  const expSup = await expected({ visibleToSupervisors: true });
  const expStudent = await expected({ visibleToStudents: true });
  T.check(`админ видит все корневые материалы (${expAdmin.length})`, expAdmin.length > 0 && sameSet(ids(adminKnowledge), expAdmin));
  T.check(`научник видит ровно материалы для НР (${expSup.length})`, expSup.length > 0 && sameSet(ids(supKnowledge), expSup));
  T.check(`студент видит ровно материалы для студентов (${expStudent.length})`, sameSet(ids(studentKnowledge), expStudent));
  if (expStudent.length === 0) console.log("    (в базе нет материалов для студентов — ветка студента проверена только на пустом наборе)");

  T.section("Рассылка напоминаний");
  const post = (client, q) => client.send("POST", `/api/events/reminders${q}`, SAFE_REMINDERS);
  T.check("гость с ?secret=admin → 403", (await post(guest, "?secret=admin")).status === 403);
  T.check("студент с ?secret=admin → 403", (await post(student, "?secret=admin")).status === 403);
  T.check("гость без секрета → 403", (await post(guest, "")).status === 403);
  const adminRun = await post(admin, "");
  T.check("админ по сессии → 200 (на пустую дату, писем 0)", adminRun.status === 200 && adminRun.body?.emailsSent === 0, `статус ${adminRun.status} ${JSON.stringify(adminRun.body)}`);
  const secret = process.env.CRON_SECRET;
  if (secret) {
    T.check("гость с верным секретом → 200 (писем 0)", (await post(guest, `?secret=${encodeURIComponent(secret)}`)).status === 200);
    T.check("гость с неверным секретом → 403", (await post(guest, `?secret=${encodeURIComponent(secret)}x`)).status === 403);
  } else {
    console.log("    пропущено: CRON_SECRET не задан — ветка «верный секрет» не проверена");
  }
} finally {
  if (accessBefore) {
    await admin.send("PUT", "/api/expert/admin/access", { cohort: "Поток2026", platformOpen: accessBefore.platformOpen });
  }
  await prisma.notification.deleteMany({ where: { id: { in: notes } } });
  await prisma.activity.deleteMany({ where: { projectId: draft.id } });
  await prisma.projectMember.deleteMany({ where: { projectId: draft.id } });
  await prisma.project.delete({ where: { id: draft.id } });
  await prisma.$disconnect();
}

T.done();
