-- Студент может предложить один проект нескольким научным руководителям:
-- уникальность по (projectId, studentId) заменяется на (projectId, studentId, supervisorId).

-- DropIndex
DROP INDEX "Application_projectId_studentId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Application_projectId_studentId_supervisorId_key" ON "Application"("projectId", "studentId", "supervisorId");
