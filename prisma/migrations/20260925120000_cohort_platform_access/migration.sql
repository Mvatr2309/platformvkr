-- A1: доступ к «Платформе ВКР» по потокам, независимо от экспертной трубы.
-- По умолчанию поток закрыт: новый поток не видит платформу, пока админ его не откроет.
-- AlterTable
ALTER TABLE "ExpertPipelineCohortAccess" ADD COLUMN     "platformOpen" BOOLEAN NOT NULL DEFAULT false;

-- Статус-кво на момент выкатки: потоки, в которых уже есть студенты, остаются
-- с открытой платформой, иначе они потеряют к ней доступ в момент миграции.
-- Лишние потоки админ закрывает вручную в разделе «Доступ по потокам».
-- Флаг трубы (isOpen) у существующих записей не трогаем, у новых — закрыто.
INSERT INTO "ExpertPipelineCohortAccess" ("id", "cohort", "isOpen", "platformOpen", "updatedAt")
SELECT gen_random_uuid()::text, c.cohort, false, true, NOW()
FROM (
  SELECT DISTINCT TRIM("cohort") AS cohort
  FROM "StudentProfile"
  WHERE TRIM("cohort") <> ''
) AS c
ON CONFLICT ("cohort") DO UPDATE SET "platformOpen" = true, "updatedAt" = NOW();
