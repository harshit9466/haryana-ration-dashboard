-- CreateTable
CREATE TABLE "monitor_config" (
    "id" SERIAL NOT NULL,
    "fpsId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "distCode" TEXT NOT NULL DEFAULT '073',
    "emails" TEXT[],
    "shopOpen" TEXT NOT NULL DEFAULT '05:00',
    "shopClose" TEXT NOT NULL DEFAULT '14:00',
    "eodTime" TEXT NOT NULL DEFAULT '21:00',
    "pollEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitor_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_monitor_state" (
    "id" SERIAL NOT NULL,
    "fpsId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "firstTxnAt" TEXT,
    "startEmailSentAt" TIMESTAMP(3),
    "eodEmailSentAt" TIMESTAMP(3),
    "lastSeenTxnCount" INTEGER NOT NULL DEFAULT 0,
    "lastPolledAt" TIMESTAMP(3),

    CONSTRAINT "daily_monitor_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_log" (
    "id" SERIAL NOT NULL,
    "fpsId" TEXT,
    "kind" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monitor_config_fpsId_key" ON "monitor_config"("fpsId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_monitor_state_fpsId_date_key" ON "daily_monitor_state"("fpsId", "date");
