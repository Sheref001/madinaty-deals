ALTER TABLE "Submission"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "ownerState" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "SavedSubmission" (
    "userId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedSubmission_pkey" PRIMARY KEY ("userId", "submissionId"),
    CONSTRAINT "SavedSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedSubmission_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SavedSubmission_userId_createdAt_idx" ON "SavedSubmission"("userId", "createdAt");
CREATE INDEX "SavedSubmission_submissionId_idx" ON "SavedSubmission"("submissionId");

CREATE TABLE "ContactActivity" (
    "userId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactActivity_pkey" PRIMARY KEY ("userId", "submissionId"),
    CONSTRAINT "ContactActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactActivity_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ContactActivity_userId_openedAt_idx" ON "ContactActivity"("userId", "openedAt");
CREATE INDEX "ContactActivity_submissionId_idx" ON "ContactActivity"("submissionId");
