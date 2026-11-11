-- AlterTable
ALTER TABLE "Application" ALTER COLUMN "cohortId" DROP NOT NULL;


-- ─── Cohorts and training are retired ─────────────────────────────────────────
-- Approved interns are on the waiting list (QUALIFIED), which matching draws from.

-- Approved interns part-way through the old cohort steps move to the waiting list.
WITH moved AS (
  UPDATE "Application" a
  SET "status" = 'QUALIFIED', "statusChangedAt" = now(), "updatedAt" = now()
  FROM "GraduateProfile" g
  WHERE a."graduateId" = g."id"
    AND g."reviewStatus" = 'APPROVED' AND g."removedAt" IS NULL
    AND a."status" IN ('SUBMITTED', 'SCREENING', 'SHORTLISTED', 'IN_TRAINING', 'FINAL_ASSESSMENT')
  RETURNING a."id", a."status"
)
INSERT INTO "ApplicationEvent" ("id", "applicationId", "fromStatus", "toStatus", "note", "createdAt", "updatedAt")
SELECT 'evt_wl_' || md5(m."id"), m."id", NULL, 'QUALIFIED',
       'Skills verified by SIIP: on the waiting list for matching', now(), now()
FROM moved m;

-- Approved interns with no active application get a waiting-list entry.
WITH created AS (
  INSERT INTO "Application" ("id", "graduateId", "cohortId", "status", "statusChangedAt", "createdAt", "updatedAt")
  SELECT 'app_wl_' || md5(g."id"), g."id", NULL, 'QUALIFIED', now(), now(), now()
  FROM "GraduateProfile" g
  WHERE g."reviewStatus" = 'APPROVED' AND g."removedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "Application" a
      WHERE a."graduateId" = g."id" AND a."status" NOT IN ('REJECTED', 'WITHDRAWN')
    )
  RETURNING "id"
)
INSERT INTO "ApplicationEvent" ("id", "applicationId", "fromStatus", "toStatus", "note", "createdAt", "updatedAt")
SELECT 'evt_wl_' || md5(c."id"), c."id", NULL, 'QUALIFIED',
       'Skills verified by SIIP: on the waiting list for matching', now(), now()
FROM created c;
