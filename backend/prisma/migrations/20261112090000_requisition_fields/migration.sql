-- AlterTable
ALTER TABLE "InternshipOpening" ADD COLUMN     "durationWeeks" INTEGER,
ADD COLUMN     "mayLeadToFullTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startDate" TIMESTAMP(3);


-- Existing openings ran as three-month internships tied to a cohort.
UPDATE "InternshipOpening" SET "durationWeeks" = 12 WHERE "durationWeeks" IS NULL;
UPDATE "InternshipOpening" o SET "startDate" = c."internshipStartsAt"
FROM "Cohort" c WHERE o."cohortId" = c."id" AND o."startDate" IS NULL;

ALTER TABLE "InternshipOpening" ADD CONSTRAINT "InternshipOpening_duration_chk"
  CHECK ("durationWeeks" IS NULL OR "durationWeeks" BETWEEN 1 AND 52);
