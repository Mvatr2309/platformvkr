-- Автор проекта может закрывать набор участников отдельным признаком.
-- У существующих проектов набор остаётся открытым.

ALTER TABLE "Project" ADD COLUMN "recruitmentClosed" BOOLEAN NOT NULL DEFAULT false;
