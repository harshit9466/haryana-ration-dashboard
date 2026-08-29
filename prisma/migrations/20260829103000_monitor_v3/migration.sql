-- monitor_v3: configurable report times
--
-- Settings: pollFrom + openedDigestTime + eodDigestTime  ->  reportTimes[] (a list
--   of IST "HH:mm" times; a status email goes out at each). Existing values are
--   preserved into the list.
-- MonitorConfig: openedOverride/eodOverride  ->  reportTimes[] (per-shop override).
-- daily_digest_state  ->  daily_report_state (tracks which report times were sent
--   per day per scope).

-- CreateTable
CREATE TABLE "daily_report_state" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "sentTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "daily_report_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_report_state_date_scope_key" ON "daily_report_state"("date", "scope");

-- DropTable
DROP TABLE "daily_digest_state";

-- AlterTable
ALTER TABLE "daily_monitor_state" DROP COLUMN "overrideEodSentAt",
DROP COLUMN "overrideOpenedSentAt";

-- AlterTable
ALTER TABLE "monitor_config" DROP COLUMN "eodOverride",
DROP COLUMN "openedOverride",
ADD COLUMN     "reportTimes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: settings — add reportTimes, carry forward old times, then drop old columns
ALTER TABLE "settings" ADD COLUMN "reportTimes" TEXT[] DEFAULT ARRAY['09:30', '11:30', '14:00', '18:00', '21:00']::TEXT[];

UPDATE "settings"
SET "reportTimes" = COALESCE(
    (
        SELECT array_agg(DISTINCT t ORDER BY t)
        FROM unnest(ARRAY["pollFrom", "openedDigestTime", "eodDigestTime"]) AS t
        WHERE t IS NOT NULL AND t <> ''
    ),
    ARRAY['09:30', '11:30', '14:00', '18:00', '21:00']::TEXT[]
);

ALTER TABLE "settings" DROP COLUMN "eodDigestTime",
DROP COLUMN "openedDigestTime",
DROP COLUMN "pollFrom";
