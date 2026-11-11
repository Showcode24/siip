-- Companies can be anywhere. The CAC number and Nigerian state apply only to
-- companies in Nigeria; others give a general business registration number.

-- AlterTable: Company
ALTER TABLE "Company" ALTER COLUMN "rcNumber" DROP NOT NULL,
ALTER COLUMN "state" DROP NOT NULL,
ADD COLUMN     "businessRegNumber" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "timeZone" TEXT;

-- AlterTable: InternshipOpening (where on-site and hybrid interns work)
ALTER TABLE "InternshipOpening" ALTER COLUMN "state" DROP NOT NULL,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "city" TEXT;

-- CreateIndex
CREATE INDEX "Company_country_idx" ON "Company"("country");

-- CreateIndex (NULLs are distinct, so companies without the number never clash)
CREATE UNIQUE INDEX "Company_country_businessRegNumber_key" ON "Company"("country", "businessRegNumber");

-- ─── Data: every existing company and opening is in Nigeria ────────────────────
UPDATE "Company" SET "country" = 'NG', "timeZone" = 'Africa/Lagos';
UPDATE "InternshipOpening" SET "country" = 'NG';
