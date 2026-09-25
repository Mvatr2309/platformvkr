// A1: доступ к «Платформе ВКР» по потокам, независимо от экспертной трубы.
// Источник: specs/08-FR-08-requirements-v2.md (A1)
//
// Запуск: node --env-file=.env scripts/scenarios/a1-cohort-platform-access.mjs
// Состояние доступа потоков и поток тестового студента восстанавливаются в конце.

import { PrismaClient } from "@prisma/client";
import { login, anon, suite } from "./lib.mjs";

const OPEN_STUDENT = "test.student.open@test.local"; // Поток2025
const LOCKED_STUDENT = "test.student.locked@test.local"; // Поток2026
const OPEN_COHORT = "Поток2025";
const LOCKED_COHORT = "Поток2026";

const VKR_STUB = "«Платформа ВКР» пока недоступна";
const EXPERT_STUB = "«Экспертная труба» пока недоступна";
const VKR_DENIED = "Платформа ВКР ещё не открыта для вашего потока";

const PAGES = [
  "/projects",
  "/projects/new",
  "/supervisors",
  "/applications",
  "/calendar",
  "/knowledge",
  "/my-projects",
  "/nir",
  "/nir/3",
  "/notifications",
];

const T = suite("A1: доступ к «Платформе ВКР» по потокам");
const prisma = new PrismaClient();

const admin = await login("test.admin@test.local");
const openStudent = await login(OPEN_STUDENT);
const lockedStudent = await login(LOCKED_STUDENT);
const supervisor = await login("test.supervisor@test.local");
const externalExpert = await login("external.expert@test.local");
const guest = anon();

const initial = (await admin.json("/api/expert/admin/access")).body;
const initialRow = (cohort) =>
  [...initial.cohorts, ...initial.orphanCohorts].find((r) => r.cohort === cohort);
const lockedUser = await prisma.user.findUnique({
  where: { email: LOCKED_STUDENT },
  select: { student: { select: { id: true, cohort: true } } },
});

const setAccess = (cohort, flags) => admin.send("PUT", "/api/expert/admin/access", { cohort, ...flags });
const setLockedCohort = (cohort) =>
  prisma.studentProfile.update({ where: { id: lockedUser.student.id }, data: { cohort } });

// Реальные id для прямых ссылок
const supervisorId = (await openStudent.json("/api/supervisors")).body?.[0]?.id;
const projectId = (await openStudent.json("/api/projects")).body?.[0]?.id;
const knowledgeId = (await admin.json("/api/knowledge")).body?.[0]?.id;
PAGES.push(`/projects/${projectId}`, `/supervisors/${supervisorId}`);
if (knowledgeId) PAGES.push(`/knowledge/${knowledgeId}`);

const isDenied = (r) => r.status === 403 && r.body?.error === VKR_DENIED;

async function expectPlatformClosed(client, label) {
  for (const path of PAGES) {
    const p = await client.page(path);
    T.check(`${label}: страница ${path} — заглушка`, p.status === 200 && p.html.includes(VKR_STUB), `статус ${p.status}${p.location ? ` → ${p.location}` : ""}`);
  }
  const reads = [
    "/api/supervisors",
    `/api/supervisors/${supervisorId}`,
    "/api/projects",
    "/api/projects?my=true",
    `/api/projects/${projectId}`,
    `/api/projects/${projectId}/activities`,
    `/api/projects/${projectId}/files`,
    `/api/projects/${projectId}/files/nonexistent/download`,
    "/api/projects/check-limit",
    "/api/applications",
    "/api/events",
    "/api/events/ical",
    "/api/knowledge",
    `/api/knowledge/${knowledgeId || "nonexistent"}`,
    `/api/knowledge/${knowledgeId || "nonexistent"}/files/nonexistent/download`,
    "/api/favorites",
    "/api/students/search?q=%D0%B0",
  ];
  for (const path of reads) {
    const r = await client.json(path);
    T.check(`${label}: GET ${path} → 403`, isDenied(r), `статус ${r.status}`);
  }
  // Записи — на несуществующие id: если гейт не сработает, реальные данные не пострадают
  const writes = [
    ["POST", "/api/applications"],
    ["PUT", "/api/applications/nonexistent"],
    ["POST", "/api/projects"],
    ["PUT", "/api/projects/nonexistent"],
    ["DELETE", "/api/projects/nonexistent"],
    ["PUT", "/api/projects/nonexistent/assignment"],
    ["POST", "/api/projects/nonexistent/files"],
    ["DELETE", "/api/projects/nonexistent/files"],
    ["POST", "/api/projects/nonexistent/manual-members"],
    ["DELETE", "/api/projects/nonexistent/manual-members"],
    ["DELETE", "/api/projects/nonexistent/members/nonexistent"],
    ["POST", "/api/favorites"],
    ["DELETE", "/api/favorites/nonexistent"],
    ["POST", "/api/events"],
  ];
  for (const [method, path] of writes) {
    const r = await client.send(method, path, {});
    T.check(`${label}: ${method} ${path} → 403`, isDenied(r), `статус ${r.status}`);
  }
}

async function expectPlatformOpen(client, label) {
  for (const path of ["/projects", "/supervisors", "/my-projects", "/knowledge", "/calendar"]) {
    const p = await client.page(path);
    T.check(`${label}: страница ${path} без заглушки`, p.status === 200 && !p.html.includes(VKR_STUB), `статус ${p.status}${p.location ? ` → ${p.location}` : ""}`);
  }
  for (const path of ["/api/supervisors", "/api/projects", "/api/knowledge", `/api/supervisors/${supervisorId}`]) {
    const r = await client.json(path);
    T.check(`${label}: GET ${path} → 200`, r.status === 200, `статус ${r.status}`);
  }
}

try {
  T.check("есть id научника, проекта для прямых ссылок", Boolean(supervisorId && projectId));

  T.section("Админка «Доступ по потокам»");
  const got = (await admin.json("/api/expert/admin/access")).body;
  T.check("GET отдаёт оба флага по каждому потоку", got.cohorts.every((r) => typeof r.isOpen === "boolean" && typeof r.platformOpen === "boolean"));
  T.check("PUT без флагов → 400", (await setAccess(LOCKED_COHORT, {})).status === 400);
  T.check("PUT с флагом не-boolean → 400", (await setAccess(LOCKED_COHORT, { platformOpen: "yes" })).status === 400);
  T.check("студент не может менять доступ → 403", (await lockedStudent.send("PUT", "/api/expert/admin/access", { cohort: LOCKED_COHORT, platformOpen: true })).status === 403);

  await setAccess(LOCKED_COHORT, { isOpen: true, platformOpen: false });
  await setAccess(OPEN_COHORT, { isOpen: true, platformOpen: true });
  await setAccess(LOCKED_COHORT, { platformOpen: true });
  let row = (await admin.json("/api/expert/admin/access")).body.cohorts.find((r) => r.cohort === LOCKED_COHORT);
  T.check("галочка платформы не задевает трубу", row.isOpen === true && row.platformOpen === true);
  await setAccess(LOCKED_COHORT, { isOpen: false });
  row = (await admin.json("/api/expert/admin/access")).body.cohorts.find((r) => r.cohort === LOCKED_COHORT);
  T.check("галочка трубы не задевает платформу", row.isOpen === false && row.platformOpen === true);

  T.section("Поток 2026: труба открыта, платформа закрыта (сценарий первокурсника)");
  await setAccess(LOCKED_COHORT, { isOpen: true, platformOpen: false });
  const acc = (await lockedStudent.json("/api/expert/access")).body;
  T.check("плитки: платформа LOCKED, труба OPEN", acc.vkr.state === "LOCKED" && acc.expert.state === "OPEN");
  const spaces = await lockedStudent.page("/spaces");
  T.check("экран выбора: на плитке платформы «ещё не открыт для вашего потока»", spaces.html.includes("Раздел ещё не открыт для вашего потока."));
  T.check("экран выбора: ссылки на платформу нет", !spaces.html.includes('href="/my-projects"'));
  await expectPlatformClosed(lockedStudent, "закрытый поток");

  const catalogPage = await lockedStudent.page("/expert/catalog");
  T.check("каталог экспертов открывается", catalogPage.status === 200 && !catalogPage.html.includes(EXPERT_STUB));
  T.check("API каталога → 200", (await lockedStudent.json("/api/expert/catalog")).status === 200);
  const profilePage = await lockedStudent.page("/profile/student");
  T.check("профиль открывается без заглушки", profilePage.status === 200 && !profilePage.html.includes(VKR_STUB));
  const profile = await lockedStudent.json("/api/profile/student");
  T.check("API профиля → 200", profile.status === 200);
  T.check("обращения в поддержку открываются", (await lockedStudent.page("/inquiries")).status === 200);
  T.check("уведомления трубы → 200", (await lockedStudent.json("/api/notifications?space=expert")).status === 200);
  T.check("справочники → 200", (await lockedStudent.json("/api/dictionaries")).status === 200);

  // Попытка открыть себе платформу, подменив поток в профиле
  const p = profile.body?.profile || profile.body || {};
  await lockedStudent.send("PUT", "/api/profile/student", { ...p, name: lockedStudent.user.name, cohort: OPEN_COHORT });
  const after = await prisma.studentProfile.findUnique({ where: { id: lockedUser.student.id }, select: { cohort: true } });
  T.check("студент не может сменить себе поток через профиль", after.cohort === LOCKED_COHORT, `поток стал ${after.cohort}`);
  T.check("и платформа по-прежнему закрыта", isDenied(await lockedStudent.json("/api/supervisors")));

  T.section("Поток 2025: всё как раньше");
  await expectPlatformOpen(openStudent, "открытый поток");
  const accOpen = (await openStudent.json("/api/expert/access")).body;
  T.check("плитки: обе OPEN", accOpen.vkr.state === "OPEN" && accOpen.expert.state === "OPEN");

  T.section("Изменение действует сразу, без перелогина");
  await setAccess(LOCKED_COHORT, { platformOpen: true });
  T.check("открыли — API научников → 200", (await lockedStudent.json("/api/supervisors")).status === 200);
  const opened = await lockedStudent.page("/projects");
  T.check("открыли — страница проектов без заглушки", opened.status === 200 && !opened.html.includes(VKR_STUB));
  T.check("открыли — плитка платформы OPEN", (await lockedStudent.json("/api/expert/access")).body.vkr.state === "OPEN");
  await setAccess(LOCKED_COHORT, { platformOpen: false });
  T.check("закрыли — API научников снова 403", isDenied(await lockedStudent.json("/api/supervisors")));
  T.check("закрыли — страница проектов снова заглушка", (await lockedStudent.page("/projects")).html.includes(VKR_STUB));

  T.section("Оба пространства закрыты");
  await setAccess(LOCKED_COHORT, { isOpen: false, platformOpen: false });
  const both = (await lockedStudent.json("/api/expert/access")).body;
  T.check("плитки: обе LOCKED", both.vkr.state === "LOCKED" && both.expert.state === "LOCKED");
  T.check("труба — своя заглушка", (await lockedStudent.page("/expert")).html.includes(EXPERT_STUB));

  T.section("Новый поток без записи и пустой поток — закрыто по умолчанию");
  await setLockedCohort("ПотокБезЗаписи_A1");
  const noRow = (await lockedStudent.json("/api/expert/access")).body;
  T.check("поток без записи: обе плитки LOCKED", noRow.vkr.state === "LOCKED" && noRow.expert.state === "LOCKED");
  T.check("поток без записи: API научников → 403", isDenied(await lockedStudent.json("/api/supervisors")));
  await setLockedCohort("");
  const empty = (await lockedStudent.json("/api/expert/access")).body;
  T.check("пустой поток: обе плитки LOCKED", empty.vkr.state === "LOCKED" && empty.expert.state === "LOCKED");
  T.check("пустой поток: страница проектов — заглушка", (await lockedStudent.page("/projects")).html.includes(VKR_STUB));
  await setLockedCohort(LOCKED_COHORT);

  T.section("Другие роли не затронуты");
  await expectPlatformOpen(supervisor, "научник");
  T.check("научник: свои проекты → 200", (await supervisor.json("/api/projects?my=true")).status === 200);
  await expectPlatformOpen(admin, "админ");
  const ext = await externalExpert.page("/projects");
  T.check("внешний эксперт: платформа уводит на /spaces", ext.status === 307 && ext.location?.endsWith("/spaces"), `статус ${ext.status} → ${ext.location}`);
  const g = await guest.page("/projects");
  T.check("гость: платформа уводит на вход", g.status === 307 && g.location?.includes("/login"), `статус ${g.status} → ${g.location}`);
  T.check("гость: публичный каталог НР (01.08) не изменился → 200", (await guest.json("/api/supervisors")).status === 200);
} finally {
  // Возвращаем как было
  for (const cohort of [OPEN_COHORT, LOCKED_COHORT]) {
    const r = initialRow(cohort);
    if (r) await setAccess(cohort, { isOpen: r.isOpen, platformOpen: r.platformOpen });
  }
  await setLockedCohort(lockedUser.student.cohort);
  await prisma.$disconnect();
}

T.done();
