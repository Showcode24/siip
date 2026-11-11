-- New interns choose their own country (no Nigerian default).
-- Existing rows keep 'NG', set by the previous migration.
-- AlterTable
ALTER TABLE "GraduateProfile" ALTER COLUMN "country" DROP NOT NULL,
ALTER COLUMN "country" DROP DEFAULT;
