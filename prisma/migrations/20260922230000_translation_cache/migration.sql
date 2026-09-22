CREATE TABLE "TranslationCache" (
    "id" UUID NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TranslationCache_cacheKey_key" ON "TranslationCache"("cacheKey");
CREATE INDEX "TranslationCache_sourceLanguage_targetLanguage_idx" ON "TranslationCache"("sourceLanguage", "targetLanguage");
