-- Избранные научные руководители (студент → НР).
-- Аддитивная миграция: создаётся новая изолированная таблица,
-- существующие таблицы и данные не затрагиваются.

-- CreateTable
CREATE TABLE "FavoriteSupervisor" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteSupervisor_studentId_idx" ON "FavoriteSupervisor"("studentId");

-- CreateIndex
CREATE INDEX "FavoriteSupervisor_supervisorId_idx" ON "FavoriteSupervisor"("supervisorId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteSupervisor_studentId_supervisorId_key" ON "FavoriteSupervisor"("studentId", "supervisorId");

-- AddForeignKey
ALTER TABLE "FavoriteSupervisor" ADD CONSTRAINT "FavoriteSupervisor_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteSupervisor" ADD CONSTRAINT "FavoriteSupervisor_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "SupervisorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
