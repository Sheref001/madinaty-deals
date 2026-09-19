-- Verification evidence is linked to the resident verification request.
-- File bytes must be stored in private object storage, never in public/ or dist/.
CREATE TYPE "VerificationDocumentType" AS ENUM ('NATIONAL_ID', 'MADINATY_ID', 'ELECTRICITY_BILL', 'WATER_BILL', 'GAS_BILL', 'LEASE_OR_OWNERSHIP', 'OTHER');

CREATE TABLE "VerificationDocument" (
    "id" UUID NOT NULL,
    "residentVerificationId" UUID NOT NULL,
    "documentType" "VerificationDocumentType" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerificationDocument_objectKey_key" ON "VerificationDocument"("objectKey");
CREATE INDEX "VerificationDocument_residentVerificationId_idx" ON "VerificationDocument"("residentVerificationId");
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_residentVerificationId_fkey" FOREIGN KEY ("residentVerificationId") REFERENCES "ResidentVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
