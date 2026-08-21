-- База знаний: тип материала (статья / файл) и видимость по ролям.
-- Существующие статьи остаются видимыми и студентам, и НР.

CREATE TYPE "MaterialType" AS ENUM ('ARTICLE', 'FILE');

ALTER TABLE "Article" ADD COLUMN "type" "MaterialType" NOT NULL DEFAULT 'ARTICLE';
ALTER TABLE "Article" ADD COLUMN "visibleToStudents" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Article" ADD COLUMN "visibleToSupervisors" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Article" ALTER COLUMN "content" SET DEFAULT '';
