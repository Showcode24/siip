-- AlterEnum
ALTER TYPE "AssessmentType" ADD VALUE 'SIIP';

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "minCheckInRating" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "retakeAfterHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "unlockAfterWeeks" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "videoId" TEXT;

-- CreateTable
CREATE TABLE "TestVideo" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "youtubeId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoWatch" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "graduateId" TEXT NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestVideo_assessmentId_order_idx" ON "TestVideo"("assessmentId", "order");

-- CreateIndex
CREATE INDEX "VideoWatch_graduateId_idx" ON "VideoWatch"("graduateId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoWatch_videoId_graduateId_key" ON "VideoWatch"("videoId", "graduateId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "TestVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestVideo" ADD CONSTRAINT "TestVideo_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoWatch" ADD CONSTRAINT "VideoWatch_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "TestVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoWatch" ADD CONSTRAINT "VideoWatch_graduateId_fkey" FOREIGN KEY ("graduateId") REFERENCES "GraduateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

