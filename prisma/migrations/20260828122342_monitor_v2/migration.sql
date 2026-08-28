-- monitor_v2: global digest model
--
-- monitor_config: per-shop emails + shop hours -> global Settings; add per-shop
--   opened/eod time overrides.
-- daily_monitor_state: start/eod flags -> opened detection + per-shop override flags.
-- New: settings (singleton), daily_digest_state (one row per day for the 2 digests).
--
-- Existing monitor_config.emails are PRESERVED: unioned into settings.notifyEmails
-- before the column is dropped. Per-shop shop-hours (shopOpen/shopClose/eodTime)
-- are NOT carried over — they become the global Settings defaults.

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "notifyEmails" TEXT[],
    "pollFrom" TEXT NOT NULL DEFAULT '05:00',
    "openedDigestTime" TEXT NOT NULL DEFAULT '13:00',
    "eodDigestTime" TEXT NOT NULL DEFAULT '21:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_digest_state" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "openedDigestSentAt" TIMESTAMP(3),
    "eodDigestSentAt" TIMESTAMP(3),

    CONSTRAINT "daily_digest_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_digest_state_date_key" ON "daily_digest_state"("date");

-- Seed the singleton settings row, carrying forward every distinct email
-- address currently configured on any shop.
INSERT INTO "settings" ("id", "notifyEmails", "updatedAt")
VALUES (
    1,
    COALESCE(
        (SELECT array_agg(DISTINCT e) FROM "monitor_config", unnest("emails") AS e WHERE e <> ''),
        ARRAY[]::text[]
    ),
    now()
)
ON CONFLICT ("id") DO NOTHING;

-- AlterTable
ALTER TABLE "daily_monitor_state" DROP COLUMN "eodEmailSentAt",
DROP COLUMN "startEmailSentAt",
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "overrideEodSentAt" TIMESTAMP(3),
ADD COLUMN     "overrideOpenedSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "monitor_config" DROP COLUMN "emails",
DROP COLUMN "eodTime",
DROP COLUMN "shopClose",
DROP COLUMN "shopOpen",
ADD COLUMN     "eodOverride" TEXT,
ADD COLUMN     "openedOverride" TEXT;
