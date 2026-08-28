-- База знаний: многосоставные материалы («книги» с главами и страницами).
-- Дерево через self-relation; существующие материалы остаются корневыми.

ALTER TYPE "MaterialType" ADD VALUE 'BOOK';

ALTER TABLE "Article" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Article" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Article" ADD CONSTRAINT "Article_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Article_parentId_idx" ON "Article"("parentId");
