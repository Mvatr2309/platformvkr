-- AlterTable: make studentId nullable for manual members
ALTER TABLE "ProjectMember" ALTER COLUMN "studentId" DROP NOT NULL;

-- AddColumn: manual member fields
ALTER TABLE "ProjectMember" ADD COLUMN "manualName" TEXT;
ALTER TABLE "ProjectMember" ADD COLUMN "manualEmail" TEXT;
ALTER TABLE "ProjectMember" ADD COLUMN "manualDirection" TEXT;
ALTER TABLE "ProjectMember" ADD COLUMN "inSystem" BOOLEAN NOT NULL DEFAULT true;
