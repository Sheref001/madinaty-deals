CREATE TABLE "ModeratorAssignment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "permissions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "matchedUserId" UUID,
    CONSTRAINT "ModeratorAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModeratorAssignment_email_key" ON "ModeratorAssignment"("email");
CREATE UNIQUE INDEX "ModeratorAssignment_phone_key" ON "ModeratorAssignment"("phone");
CREATE UNIQUE INDEX "ModeratorAssignment_matchedUserId_key" ON "ModeratorAssignment"("matchedUserId");
CREATE INDEX "ModeratorAssignment_status_createdAt_idx" ON "ModeratorAssignment"("status", "createdAt");
ALTER TABLE "ModeratorAssignment" ADD CONSTRAINT "ModeratorAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModeratorAssignment" ADD CONSTRAINT "ModeratorAssignment_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
