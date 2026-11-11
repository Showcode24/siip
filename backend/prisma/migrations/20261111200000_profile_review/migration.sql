-- AlterTable
ALTER TABLE "GraduateProfile" ADD COLUMN     "removalReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT;

-- CreateIndex
CREATE INDEX "GraduateProfile_removedAt_idx" ON "GraduateProfile"("removedAt");

