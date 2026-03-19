-- Add "about" field to StudentProfile
ALTER TABLE "StudentProfile" ADD COLUMN "about" TEXT;

-- Add "projectTypes" field to SupervisorProfile
ALTER TABLE "SupervisorProfile" ADD COLUMN "projectTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
