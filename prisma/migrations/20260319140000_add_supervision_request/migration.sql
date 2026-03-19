-- Add SUPERVISION_REQUEST to ApplicationType enum
ALTER TYPE "ApplicationType" ADD VALUE 'SUPERVISION_REQUEST';

-- Add new statuses to ApplicationStatus enum
ALTER TYPE "ApplicationStatus" ADD VALUE 'INTERESTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'DECLINED';
