-- FR-08: Экспертная труба
-- Источник: specs/08-FR-08-expert-pipeline.md (раздел 5)
-- CreateEnum
CREATE TYPE "ExpertRequestStatus" AS ENUM ('NEW', 'APPROVED_BY_MODERATOR', 'REJECTED_BY_MODERATOR', 'REJECTED_BY_EXPERT', 'CONTACTS_SENT', 'AWAITING_FEEDBACK', 'CLOSED');

-- CreateEnum
CREATE TYPE "FeedbackAuthorSide" AS ENUM ('STUDENT', 'EXPERT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "NotificationType" ADD VALUE 'EXPERT_REQUEST_NEW';
ALTER TYPE "NotificationType" ADD VALUE 'EXPERT_REQUEST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'EXPERT_REQUEST_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'EXPERT_REQUEST_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'EXPERT_FEEDBACK_REQUEST';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'EXPERT';

-- CreateTable
CREATE TABLE "ExpertProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workplace" TEXT NOT NULL DEFAULT '',
    "position" TEXT NOT NULL DEFAULT '',
    "academicTitle" TEXT NOT NULL DEFAULT '',
    "academicDegree" TEXT NOT NULL DEFAULT '',
    "resumeUrl" TEXT,
    "photoUrl" TEXT,
    "expertise" TEXT[],
    "helpTopics" TEXT,
    "directions" TEXT[],
    "projectTypes" TEXT[],
    "contact" TEXT NOT NULL DEFAULT '',
    "cardCompleted" BOOLEAN NOT NULL DEFAULT false,
    "hiddenByOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "expectedResult" TEXT NOT NULL,
    "ownProgress" TEXT NOT NULL,
    "directionSnapshot" TEXT NOT NULL,
    "courseSnapshot" INTEGER NOT NULL,
    "status" "ExpertRequestStatus" NOT NULL DEFAULT 'NEW',
    "moderatorComment" TEXT,
    "expertComment" TEXT,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "contactsSentAt" TIMESTAMP(3),
    "feedbackRequestedAt" TIMESTAMP(3),
    "feedbackReminderSentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedWithoutFeedback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertRequestFeedback" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorSide" "FeedbackAuthorSide" NOT NULL,
    "metHappened" BOOLEAN NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpertRequestFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertPipelineCohortAccess" (
    "id" TEXT NOT NULL,
    "cohort" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertPipelineCohortAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpertProfile_userId_key" ON "ExpertProfile"("userId");

-- CreateIndex
CREATE INDEX "ExpertProfile_cardCompleted_hiddenByOwner_idx" ON "ExpertProfile"("cardCompleted", "hiddenByOwner");

-- CreateIndex
CREATE INDEX "ExpertRequest_status_idx" ON "ExpertRequest"("status");

-- CreateIndex
CREATE INDEX "ExpertRequest_expertId_status_idx" ON "ExpertRequest"("expertId", "status");

-- CreateIndex
CREATE INDEX "ExpertRequest_studentId_idx" ON "ExpertRequest"("studentId");

-- CreateIndex
CREATE INDEX "ExpertRequest_status_contactsSentAt_idx" ON "ExpertRequest"("status", "contactsSentAt");

-- CreateIndex
CREATE INDEX "ExpertRequest_status_feedbackRequestedAt_idx" ON "ExpertRequest"("status", "feedbackRequestedAt");

-- CreateIndex
CREATE INDEX "ExpertRequestFeedback_requestId_idx" ON "ExpertRequestFeedback"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpertRequestFeedback_requestId_authorSide_key" ON "ExpertRequestFeedback"("requestId", "authorSide");

-- CreateIndex
CREATE UNIQUE INDEX "ExpertPipelineCohortAccess_cohort_key" ON "ExpertPipelineCohortAccess"("cohort");

-- AddForeignKey
ALTER TABLE "ExpertProfile" ADD CONSTRAINT "ExpertProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertRequest" ADD CONSTRAINT "ExpertRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertRequest" ADD CONSTRAINT "ExpertRequest_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "ExpertProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertRequestFeedback" ADD CONSTRAINT "ExpertRequestFeedback_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExpertRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
