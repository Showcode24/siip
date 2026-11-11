-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProfileReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "SkillDocumentKind" AS ENUM ('FILE', 'LINK');

-- DropIndex
DROP INDEX "GraduateSkill_skillId_idx";

-- AlterTable
ALTER TABLE "GraduateProfile" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "ProfileReviewStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GraduateSkill" ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "issuingBody" TEXT,
ADD COLUMN     "otherName" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "SkillStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedLevel" "SkillLevel",
ALTER COLUMN "skillId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SkillDocument" (
    "id" TEXT NOT NULL,
    "graduateSkillId" TEXT NOT NULL,
    "kind" "SkillDocumentKind" NOT NULL,
    "publicId" TEXT,
    "fileName" TEXT,
    "format" TEXT,
    "bytes" INTEGER,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillDocument_graduateSkillId_idx" ON "SkillDocument"("graduateSkillId");

-- CreateIndex
CREATE INDEX "GraduateProfile_reviewStatus_submittedAt_idx" ON "GraduateProfile"("reviewStatus", "submittedAt");

-- CreateIndex
CREATE INDEX "GraduateSkill_skillId_status_idx" ON "GraduateSkill"("skillId", "status");

-- AddForeignKey
ALTER TABLE "SkillDocument" ADD CONSTRAINT "SkillDocument_graduateSkillId_fkey" FOREIGN KEY ("graduateSkillId") REFERENCES "GraduateSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Integrity the app relies on ─────────────────────────────────────────────
ALTER TABLE "GraduateSkill" ADD CONSTRAINT "GraduateSkill_skill_or_other_chk"
  CHECK ("skillId" IS NOT NULL OR length(trim(coalesce("otherName", ''))) > 0);
ALTER TABLE "GraduateSkill" ADD CONSTRAINT "GraduateSkill_verified_level_chk"
  CHECK ("status" <> 'VERIFIED' OR "verifiedLevel" IS NOT NULL);
ALTER TABLE "GraduateSkill" ADD CONSTRAINT "GraduateSkill_rejection_reason_chk"
  CHECK ("status" <> 'REJECTED' OR length(trim(coalesce("rejectionReason", ''))) > 0);
ALTER TABLE "SkillDocument" ADD CONSTRAINT "SkillDocument_kind_chk"
  CHECK (("kind" = 'FILE' AND "publicId" IS NOT NULL) OR ("kind" = 'LINK' AND "url" IS NOT NULL));

-- ─── Skill catalogue, grouped so companies can find skills by area ────────────
INSERT INTO "Skill" ("id", "name", "slug", "category", "isActive", "createdAt", "updatedAt") VALUES
  ('skl_' || md5('accounting'), 'Accounting', 'accounting', 'Business and finance', true, now(), now()),
  ('skl_' || md5('web-development'), 'Web Development', 'web-development', 'Technology', true, now(), now()),
  ('skl_' || md5('translation'), 'Translation', 'translation', 'Languages', true, now(), now())
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Skill" SET "category" = CASE "slug"
  WHEN 'graphic-design' THEN 'Design and media'
  WHEN 'video-editing' THEN 'Design and media'
  WHEN 'photo-editing' THEN 'Design and media'
  WHEN 'smartphone-videography' THEN 'Design and media'
  WHEN 'content-creation' THEN 'Design and media'
  WHEN 'social-media-management' THEN 'Marketing and sales'
  WHEN 'digital-marketing' THEN 'Marketing and sales'
  WHEN 'copywriting' THEN 'Marketing and sales'
  WHEN 'sales' THEN 'Marketing and sales'
  WHEN 'web-development' THEN 'Technology'
  WHEN 'basic-web-design' THEN 'Technology'
  WHEN 'accounting' THEN 'Business and finance'
  WHEN 'microsoft-excel' THEN 'Business and finance'
  WHEN 'data-entry' THEN 'Business and finance'
  WHEN 'administration' THEN 'Business and finance'
  WHEN 'research' THEN 'Business and finance'
  WHEN 'customer-service' THEN 'Business and finance'
  WHEN 'translation' THEN 'Languages'
  ELSE "category" END;

-- Existing skills have no proof yet: they start PENDING (the column default), so
-- interns upload documents and SIIP re-checks them before they are matched.
-- Interns already on an internship carry on unaffected.
