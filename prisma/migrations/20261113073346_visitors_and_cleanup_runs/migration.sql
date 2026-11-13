-- AlterTable
ALTER TABLE "daily_stats" ADD COLUMN     "cleanupRuns" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "presence" (
    "key" TEXT NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "region" VARCHAR(8) NOT NULL DEFAULT '',
    "lat" SMALLINT,
    "lon" SMALLINT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presence_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "visit_daily" (
    "day" DATE NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "region" VARCHAR(8) NOT NULL DEFAULT '',
    "visits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visit_daily_pkey" PRIMARY KEY ("day","country","region")
);

-- CreateIndex
CREATE INDEX "presence_lastSeen_idx" ON "presence"("lastSeen");
