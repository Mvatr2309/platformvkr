-- FR-08: поля анкеты запроса (08.12)
-- Где возникли проблемы, ссылка на материалы, связь с проектом студента
-- AlterTable
ALTER TABLE "ExpertRequest" ADD COLUMN     "materialsUrl" TEXT,
ADD COLUMN     "problemArea" TEXT,
ADD COLUMN     "projectId" TEXT;

-- AddForeignKey
ALTER TABLE "ExpertRequest" ADD CONSTRAINT "ExpertRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

