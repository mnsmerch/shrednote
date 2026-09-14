-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "wrapIv" TEXT NOT NULL,
    "kdfSalt" TEXT NOT NULL,
    "kdfIterations" INTEGER NOT NULL,
    "passwordProtected" BOOLEAN NOT NULL DEFAULT false,
    "authTokenHash" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "requireConfirm" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "daily_stats" (
    "day" DATE NOT NULL,
    "notesCreated" INTEGER NOT NULL DEFAULT 0,
    "notesConsumed" INTEGER NOT NULL DEFAULT 0,
    "notesExpired" INTEGER NOT NULL DEFAULT 0,
    "noteLinkVisits" INTEGER NOT NULL DEFAULT 0,
    "rateLimitHits" INTEGER NOT NULL DEFAULT 0,
    "failedPasswordAttempts" INTEGER NOT NULL DEFAULT 0,
    "notesDestroyedByBrute" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "notes_expiresAt_idx" ON "notes"("expiresAt");

-- CreateIndex
CREATE INDEX "notes_consumedAt_idx" ON "notes"("consumedAt");

-- CreateIndex
CREATE INDEX "rate_limits_expiresAt_idx" ON "rate_limits"("expiresAt");

