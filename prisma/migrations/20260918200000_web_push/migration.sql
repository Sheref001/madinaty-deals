CREATE TABLE "PushSubscription" (
  "id" UUID NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "applicationServerKey" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "zones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_language_idx" ON "PushSubscription"("language");
CREATE TABLE "PushCampaign" (
  "id" UUID NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "advertiserName" TEXT NOT NULL,
  "offerTitle" TEXT NOT NULL,
  "offerDetails" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "zone" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "feeCents" INTEGER NOT NULL,
  "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushCampaign_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PushDelivery" (
  "campaignId" UUID NOT NULL,
  "subscriptionId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ATTEMPTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("campaignId", "subscriptionId"),
  CONSTRAINT "PushDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PushCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
