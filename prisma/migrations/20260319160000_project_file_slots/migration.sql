-- Create ProjectFileType enum
CREATE TYPE "ProjectFileType" AS ENUM ('FILE', 'LINK');

-- Add new columns to ProjectFile
ALTER TABLE "ProjectFile" ADD COLUMN "title" TEXT;
ALTER TABLE "ProjectFile" ADD COLUMN "fileType" "ProjectFileType" NOT NULL DEFAULT 'FILE';
ALTER TABLE "ProjectFile" ADD COLUMN "url" TEXT;

-- Backfill title from filename for existing records
UPDATE "ProjectFile" SET "title" = "filename" WHERE "title" IS NULL;

-- Make title required
ALTER TABLE "ProjectFile" ALTER COLUMN "title" SET NOT NULL;

-- Make filename and filepath optional (they were required before)
ALTER TABLE "ProjectFile" ALTER COLUMN "filename" DROP NOT NULL;
ALTER TABLE "ProjectFile" ALTER COLUMN "filepath" DROP NOT NULL;
