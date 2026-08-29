import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getFpsTransactions } from "@/lib/eposApi";
import { sendStatusReport, type ShopSnapshot } from "@/lib/mailer";
import { currentMonthYear } from "@/lib/params";
import { dateTime, shortDate } from "@/lib/format";
import { istDateKey, istTimeHm, hmToMinutes } from "@/lib/normalize";

/**
 * One poll cycle. The Railway "cron" service hits /api/cron/poll every ~15 min,
 * which calls this.
 *
 * Model: `Settings.reportTimes` is a list of IST "HH:mm" times. At each one, a
 * single combined status email goes out — for every monitored shop: is it open,
 * since when, and what has it dispensed so far today. The last time of the day
 * is effectively the end-of-day report.
 *
 * A shop with its own `reportTimes` is excluded from the global report and gets
 * its own email at its own times.
 *
 * The cron is just a heartbeat — WHEN reports go out is entirely DB-driven and
 * editable from the admin page with no redeploy.
 *
 * Idempotent — `daily_report_state.sentTimes` (per day, per scope) prevents repeats.
 */

export type PollOutcome = {
  scope: string;
  action: "skip" | "report-sent" | "error" | "nothing";
  detail?: string;
};

export async function runPoll(
  opts: { force?: boolean } = {},
): Promise<{ ranAt: string; ist: string; results: PollOutcome[] }> {
  const now = new Date();
  const today = istDateKey(now);
  const nowMin = hmToMinutes(istTimeHm(now));
  const { month, year } = currentMonthYear();
  const results: PollOutcome[] = [];

  const settings = await getSettings();
  const recipients = effectiveRecipients(settings.notifyEmails);
  const configs = await prisma.monitorConfig.findMany({
    where: { pollEnabled: true },
    orderBy: { createdAt: "asc" },
  });

  const globalShops = configs.filter((c) => c.reportTimes.length === 0);
  const overrideShops = configs.filter((c) => c.reportTimes.length > 0);

  await maybeSendReport({
    scope: "global",
    shops: globalShops,
    times: settings.reportTimes,
    ctx: { today, nowMin, month, year, recipients, force: opts.force ?? false },
    results,
  });

  for (const shop of overrideShops) {
    await maybeSendReport({
      scope: shop.fpsId,
      shops: [shop],
      times: shop.reportTimes,
      ctx: { today, nowMin, month, year, recipients, force: opts.force ?? false },
      results,
    });
  }

  if (results.length === 0) {
    results.push({ scope: "all", action: "nothing" });
  }
  return { ranAt: now.toISOString(), ist: `${today} ${istTimeHm(now)}`, results };
}

type Config = Awaited<ReturnType<typeof prisma.monitorConfig.findMany>>[number];

type Ctx = {
  today: string;
  nowMin: number;
  month: number;
  year: number;
  recipients: string[];
  force: boolean;
};

async function maybeSendReport({
  scope,
  shops,
  times,
  ctx,
  results,
}: {
  scope: string;
  shops: Config[];
  times: string[];
  ctx: Ctx;
  results: PollOutcome[];
}): Promise<void> {
  if (shops.length === 0) {
    return;
  }

  const state = await prisma.dailyReportState.upsert({
    where: { date_scope: { date: ctx.today, scope } },
    create: { date: ctx.today, scope },
    update: {},
  });

  const due = ctx.force
    ? times
    : times.filter(
        (t) => hmToMinutes(t) <= ctx.nowMin && !state.sentTimes.includes(t),
      );

  if (!ctx.force && due.length === 0) {
    results.push({ scope, action: "skip", detail: "no report due" });
    return;
  }

  const snapshots: ShopSnapshot[] = [];
  for (const s of shops) {
    snapshots.push(await pollShop(s, ctx));
  }

  const atTime = ctx.force
    ? istTimeHm(new Date())
    : ([...due].sort().pop() ?? istTimeHm(new Date()));

  const res = await sendStatusReport(ctx.recipients, {
    dateStr: shortDate(ctx.today),
    atTime,
    shops: snapshots,
  });

  if (res.ok && !ctx.force) {
    await prisma.dailyReportState.update({
      where: { id: state.id },
      data: { sentTimes: [...new Set([...state.sentTimes, ...due])] },
    });
  }

  results.push({
    scope,
    action: res.ok ? "report-sent" : "error",
    detail: res.ok
      ? `${snapshots.length} shop(s) @ ${atTime}`
      : (res.error ?? "send failed"),
  });
}

async function pollShop(config: Config, ctx: Ctx): Promise<ShopSnapshot> {
  const label = config.label || config.fpsId;
  try {
    const txns = await getFpsTransactions(
      config.fpsId,
      ctx.month,
      ctx.year,
      ctx.today,
    );
    const firstAt = txns.transactions
      .map((t) => t.loginTime)
      .filter(Boolean)
      .sort()[0];
    const now = new Date();

    const existing = await prisma.dailyMonitorState.findUnique({
      where: { fpsId_date: { fpsId: config.fpsId, date: ctx.today } },
    });
    await prisma.dailyMonitorState.upsert({
      where: { fpsId_date: { fpsId: config.fpsId, date: ctx.today } },
      create: {
        fpsId: config.fpsId,
        date: ctx.today,
        lastSeenTxnCount: txns.count,
        lastPolledAt: now,
        openedAt: txns.count > 0 ? now : null,
        firstTxnAt: firstAt ?? null,
      },
      update: {
        lastSeenTxnCount: txns.count,
        lastPolledAt: now,
        ...(txns.count > 0 && !existing?.openedAt ? { openedAt: now } : {}),
        ...(firstAt ? { firstTxnAt: firstAt } : {}),
      },
    });

    return {
      label,
      fpsId: config.fpsId,
      opened: txns.count > 0,
      firstTxnAt: firstAt ? dateTime(firstAt) : null,
      cards: txns.count,
      totalAmount: txns.totalAmount,
      commodities: txns.byCommodity.map((c) => ({
        commodity: c.commodity,
        qty: c.qty,
      })),
    };
  } catch (err) {
    return {
      label,
      fpsId: config.fpsId,
      opened: false,
      firstTxnAt: null,
      cards: 0,
      totalAmount: 0,
      commodities: [],
      error: err instanceof Error ? err.message : "poll failed",
    };
  }
}

export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, notifyEmails: [] },
    update: {},
  });
}

/** Settings recipients, or the NOTIFY_EMAIL env fallback if none are set. */
function effectiveRecipients(fromSettings: string[]): string[] {
  if (fromSettings.length > 0) {
    return fromSettings;
  }
  const fallback = env().NOTIFY_EMAIL.trim();
  return fallback ? [fallback] : [];
}
