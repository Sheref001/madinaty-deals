ALTER TABLE "Submission" ADD COLUMN "statusBeforeHide" TEXT;
CREATE TABLE "ContentControl" (
  "id" UUID NOT NULL,
  "contentType" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentControl_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentControl_contentType_contentId_key" ON "ContentControl"("contentType", "contentId");
CREATE INDEX "ContentControl_status_updatedAt_idx" ON "ContentControl"("status", "updatedAt");
CREATE TABLE "PublicationPause" (
  "category" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicationPause_pkey" PRIMARY KEY ("category")
);
