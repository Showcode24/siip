-- CreateEnum
CREATE TYPE "InternType" AS ENUM ('NYSC_CORPS_MEMBER', 'UNDERGRADUATE', 'GRADUATE');

-- AlterTable
ALTER TABLE "GraduateProfile" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'NG',
ADD COLUMN     "internType" "InternType" NOT NULL DEFAULT 'GRADUATE',
ADD COLUMN     "nyscBatch" TEXT,
ADD COLUMN     "nyscStateCode" TEXT,
ADD COLUMN     "workPreference" "WorkMode";

-- CreateIndex
CREATE INDEX "GraduateProfile_country_city_idx" ON "GraduateProfile"("country", "city");

-- CreateIndex
CREATE INDEX "GraduateProfile_internType_idx" ON "GraduateProfile"("internType");

-- ─── Data: existing interns ───────────────────────────────────────────────────
-- Everyone registered so far is in Nigeria (country defaults to 'NG' above).
-- Serving corps members become NYSC corps members; everyone else is a graduate
-- (the column default). No existing data is removed.
UPDATE "GraduateProfile" SET "internType" = 'NYSC_CORPS_MEMBER' WHERE "nyscStatus" = 'SERVING';

-- ─── Search: index city and country alongside the Nigerian state/LGA ──────────
CREATE OR REPLACE FUNCTION siip_profile_search_doc(p "GraduateProfile") RETURNS tsvector
LANGUAGE sql STABLE AS $$
  SELECT
    setweight(to_tsvector('english', coalesce(p."courseOfStudy", '') || ' ' || coalesce(p."institution", '')), 'A') ||
    setweight(to_tsvector('english', coalesce((
      SELECT string_agg(s."name", ' ')
      FROM "GraduateSkill" gs JOIN "Skill" s ON s."id" = gs."skillId"
      WHERE gs."graduateId" = p."id"
    ), '')), 'A') ||
    setweight(to_tsvector('english',
      coalesce(p."city", '') || ' ' || coalesce(p."country", '') || ' ' ||
      coalesce(p."stateOfResidence", '') || ' ' || coalesce(p."lga", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(p."bio", '')), 'C')
$$;

DROP TRIGGER IF EXISTS graduate_profile_search_vector ON "GraduateProfile";
CREATE TRIGGER graduate_profile_search_vector
BEFORE INSERT OR UPDATE OF "courseOfStudy", "institution", "stateOfResidence", "lga", "city", "country", "bio"
ON "GraduateProfile" FOR EACH ROW EXECUTE FUNCTION siip_profile_search_before();

-- Refresh existing rows so the new fields are searchable.
UPDATE "GraduateProfile" p SET "searchVector" = siip_profile_search_doc(p);
