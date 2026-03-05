-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('NONE', 'PENDING_SUPERVISOR', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "assignmentStatus" "AssignmentStatus" NOT NULL DEFAULT 'NONE';
