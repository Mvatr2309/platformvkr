// A2: одна учётная запись с ролями научника и эксперта.
// Источник: specs/08-FR-08-requirements-v2.md (A2)
//
// Запуск: node --env-file=.env scripts/scenarios/a2-expert-role.mjs
// Роль эксперта выдаётся test.supervisor2 и снимается в конце; временный научник,
// заведённый через «Создание аккаунтов», удаляется. Письма уходят на *@test.local.

import { PrismaClient } from "@prisma/client";
import { login, anon, suite } from "./lib.mjs";

const SUPERVISOR = "test.supervisor2@test.local"; // полный профиль НР, роли эксперта нет
const SUPERVISOR_EXPERT = "test.supervisor@test.local"; // уже с карточкой эксперта
const STUDENT = "test.student.open@test.local";
const EXTERNAL = "external.expert@test.local";
const NEW_SUPERVISOR = `a2.scenario.${Date.now()}@test.local`;

const T = suite("A2: роль эксперта у научного руководителя");
const prisma = new PrismaClient();

const admin = await login("test.admin@test.local");
const supervisor = await login(SUPERVISOR);
const student = await login(STUDENT);
const external = await login(EXTERNAL);

const supervisorUser = await prisma.user.findUnique({
  where: { email: SUPERVISOR },
  select: { id: true, name: true, supervisor: { select: { workplace: true, position: true, contact: true } }, expert: { select: { id: true } } },
});
const hadCard = Boolean(supervisorUser.expert);
const dropCard = () => prisma.expertProfile.deleteMany({ where: { userId: supervisorUser.id } });

const invite = (email) => admin.send("POST", "/api/admin/invitations", { email, role: "EXPERT" });
const grant = (client, email) => client.send("POST", "/api/expert/admin/grant-role", { email });
const bulk = (emails, withExpertRole) =>
  admin.send("POST", "/api/admin/invitations/bulk", { emails, role: "SUPERVISOR", withExpertRole });

try {
  if (hadCard) await dropCard();

  T.section("«Внешние эксперты»: почта уже занята — кто это");
  const inv = await invite(SUPERVISOR);
  T.check("почта научника → 409 с ролью и ФИО", inv.status === 409 && inv.body.existing?.role === "SUPERVISOR" && inv.body.existing?.isExpert === false && inv.body.existing?.name === supervisorUser.name);
  const invStudent = await invite(STUDENT);
  T.check("почта студента → 409 с ролью STUDENT", invStudent.status === 409 && invStudent.body.existing?.role === "STUDENT");
  T.check("второй аккаунт не создан", (await prisma.user.count({ where: { email: SUPERVISOR } })) === 1);

  T.section("Выдача роли существующему научнику");
  T.check("не админ не может выдать роль → 403", (await grant(supervisor, SUPERVISOR)).status === 403);
  const gStudent = await grant(admin, STUDENT);
  T.check("студенту роль не выдаётся → 409", gStudent.status === 409 && gStudent.body.error.includes("студентам не выдаётся"));
  const gExternal = await grant(admin, EXTERNAL);
  T.check("внешнему эксперту — «уже внешний эксперт» → 409", gExternal.status === 409 && gExternal.body.error.includes("уже внешний эксперт"));
  T.check("админу роль не выдаётся → 409", (await grant(admin, "test.admin@test.local")).status === 409);
  T.check("неизвестная почта → 404", (await grant(admin, "nobody.a2@test.local")).status === 404);

  const g = await grant(admin, SUPERVISOR.toUpperCase());
  T.check("научнику роль открыта (почта без учёта регистра)", g.status === 200 && g.body.granted === true, `статус ${g.status} ${g.body?.error || ""}`);
  const card = await prisma.expertProfile.findUnique({ where: { userId: supervisorUser.id } });
  T.check("карточка заполнена из профиля научника", card?.workplace === supervisorUser.supervisor.workplace && card?.position === supervisorUser.supervisor.position && card?.contact === supervisorUser.supervisor.contact);
  T.check("полный профиль — карточка сразу в каталоге", card?.cardCompleted === true && g.body.cardCompleted === true);
  const u = await prisma.user.findUnique({ where: { id: supervisorUser.id }, select: { role: true } });
  T.check("роль в учётной записи осталась «научник»", u.role === "SUPERVISOR");
  T.check("одна учётная запись на почту", (await prisma.user.count({ where: { email: SUPERVISOR } })) === 1);
  const again = await grant(admin, SUPERVISOR);
  T.check("повторная выдача → 409 «уже есть»", again.status === 409 && again.body.error.includes("уже есть"));
  const invAgain = await invite(SUPERVISOR);
  T.check("после выдачи «Внешние эксперты» знают, что он уже эксперт", invAgain.status === 409 && invAgain.body.existing?.isExpert === true);

  T.section("Научник с двумя ролями — без повторного входа");
  const acc = (await supervisor.json("/api/expert/access")).body;
  T.check("в той же сессии обе плитки открыты", acc.vkr.state === "OPEN" && acc.expert.state === "OPEN", JSON.stringify(acc));
  const inbox = await supervisor.json("/api/expert/requests");
  T.check("входящие трубы доступны", inbox.status === 200);
  T.check("платформа по-прежнему работает: свои проекты", (await supervisor.json("/api/projects?my=true")).status === 200);
  const catalog = (await student.json("/api/expert/catalog")).body;
  const inCatalog = JSON.stringify(catalog).includes(card.id);
  T.check("студент видит карточку в каталоге", inCatalog);
  const expertsList = (await admin.json("/api/expert/admin/experts")).body;
  T.check("в «Эксперты в разделе» он помечен научником", expertsList.some((e) => e.email === SUPERVISOR && e.role === "SUPERVISOR"));

  T.section("«Принять участие» сам — та же логика");
  await dropCard();
  const join1 = await supervisor.send("POST", "/api/expert/join", {});
  T.check("научник подключил роль сам", join1.status === 200 && join1.body.created === true && join1.body.cardCompleted === true);
  const join2 = await supervisor.send("POST", "/api/expert/join", {});
  T.check("повторное нажатие ничего не ломает", join2.status === 200 && join2.body.created === false);

  T.section("«Создание аккаунтов»: научник сразу с ролью эксперта");
  await dropCard();
  const b1 = await bulk([NEW_SUPERVISOR, SUPERVISOR, SUPERVISOR_EXPERT, STUDENT], true);
  const byEmail = (email) => b1.body.results.find((r) => r.email === email);
  T.check("новый научник создан", ["created", "created_mail_error"].includes(byEmail(NEW_SUPERVISOR)?.status));
  T.check("существующему научнику роль добавлена", byEmail(SUPERVISOR)?.status === "role_granted");
  T.check("научник, который уже эксперт, пропущен с понятной причиной", byEmail(SUPERVISOR_EXPERT)?.status === "skipped" && byEmail(SUPERVISOR_EXPERT)?.reason.includes("эксперт"));
  T.check("студент пропущен как зарегистрированный", byEmail(STUDENT)?.status === "skipped" && byEmail(STUDENT)?.reason === "уже зарегистрирован");
  T.check("в сводке посчитаны выданные роли", b1.body.summary.rolesGranted === 1);
  T.check("карточка существующему научнику создана", Boolean(await prisma.expertProfile.findUnique({ where: { userId: supervisorUser.id } })));

  const newUser = await prisma.user.findUnique({ where: { email: NEW_SUPERVISOR }, select: { id: true, role: true, expert: { select: { cardCompleted: true } } } });
  T.check("новый аккаунт — научник с карточкой эксперта", newUser?.role === "SUPERVISOR" && newUser?.expert?.cardCompleted === false);
  const fresh = await login(NEW_SUPERVISOR, byEmail(NEW_SUPERVISOR).password);
  const freshAcc = (await fresh.json("/api/expert/access")).body;
  T.check("новый научник видит трубу открытой", freshAcc.expert.state === "OPEN");
  const noSuggest = (await fresh.json("/api/expert/profile")).body;
  T.check("профиля НР ещё нет — подсказки нет", noSuggest.profile && noSuggest.suggestion === null);
  await prisma.supervisorProfile.create({
    data: { userId: newUser.id, workplace: "A2 Сценарий", position: "Доцент", academicTitle: "Нет", academicDegree: "", contact: "a2@test.local", expertise: ["Тест"], directions: [], projectTypes: [] },
  });
  const withSuggest = (await fresh.json("/api/expert/profile")).body;
  T.check("профиль заполнен — карточка подсказывает его поля", withSuggest.suggestion?.workplace === "A2 Сценарий" && withSuggest.suggestion?.expertise?.includes("Тест"));
  const stillEmpty = await prisma.expertProfile.findUnique({ where: { userId: newUser.id }, select: { workplace: true } });
  T.check("подсказка в базу не пишется до сохранения", stillEmpty.workplace === "");

  const b2 = await bulk([SUPERVISOR], false);
  T.check("без галочки существующий научник пропускается, как раньше", b2.body.results[0]?.status === "skipped" && b2.body.results[0]?.reason === "уже зарегистрирован");

  T.section("Внешний эксперт не становится научником");
  const b3 = await bulk([EXTERNAL], true);
  T.check("«Создание аккаунтов» не превращает эксперта в научника", b3.body.results[0]?.status === "skipped");
  T.check("«Принять участие» внешнему эксперту → 403", (await external.send("POST", "/api/expert/join", {})).status === 403);
  T.check("профиль научника внешнему эксперту → 403", (await external.send("PUT", "/api/profile/supervisor", { workplace: "x" })).status === 403);
  const extUser = await prisma.user.findUnique({ where: { email: EXTERNAL }, select: { role: true, supervisor: { select: { id: true } } } });
  T.check("у внешнего эксперта ни роли, ни профиля научника", extUser.role === "EXPERT" && !extUser.supervisor);
  T.check("гость не может выдать роль → 401", (await grant(anon(), SUPERVISOR)).status === 401);
} finally {
  await prisma.user.deleteMany({ where: { email: NEW_SUPERVISOR } });
  await prisma.invitation.deleteMany({ where: { email: NEW_SUPERVISOR } });
  if (!hadCard) await dropCard();
  await prisma.$disconnect();
}

T.done();
