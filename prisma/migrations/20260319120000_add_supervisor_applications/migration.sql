-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('STUDENT', 'SUPERVISOR');

-- AlterTable: add type column with default STUDENT
ALTER TABLE "Application" ADD COLUMN "type" "ApplicationType" NOT NULL DEFAULT 'STUDENT';

-- AlterTable: make studentId optional (was required)
ALTER TABLE "Application" ALTER COLUMN "studentId" DROP NOT NULL;
