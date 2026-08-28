import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getFpsTransactions } from "@/lib/eposApi";
import {
  sendOpenedDigest,
  sendEodDigest,
  sendOpenedSingle,
  sendEodSingle,
  type ShopOpenedLine,
  type ShopEodLine,
} from "@/lib/mailer";
import { currentMonthYear } from "@/lib/params";
import { dateTime, shortDate } from "@/lib/format";
import { istDateKey, istTimeHm, hmToMinutes } from "@/lib/normalize";

/**
 * One poll cycle. The Railway "cron" service hits /api/cron/poll every ~2h,
 * which calls this.
 *
 * Model:
 *  - For each enabled shop we detect when it first sells today (opened).
 *  - One combined "shops opened" digest is emailed once all non-override shops
 *    have opened, or by Settings.openedDigestTime — whichever comes first.
 *  - One combined end-of-day digest is emailed at Settings.eodDigestTime with
 *    every non-override shop's full-day totals.
 *  - A shop with an openedOverride / eodOverride is excluded from the matching
 *    digest and gets its own email at its own time.
 *
 * Idempotent — daily_digest_state and daily_monitor_state flags prevent repeats.
 */

export type PollOutcome = {
  scope: string;
  action:
    | "skip-hours"
    | "polled"
    | "opened-detected"
    | "opened-digest-sent"
    | "eod-digest-sent"
    | "opened-single-sent"
    | "eod-single-sent"
    | "nothing"
    | "error";
  detail?: string;
};

export async function runPoll(): Promise<{
  ranAt: string;
  ist: string;
  results: PollOutcome[];
}> {
  const now = new Date();
  const today = istDateKey(now);
  const nowMin = hmToMinutes(istTimeHm(now));
  const { month, year } = currentMonthYear();
  const results: PollOutcome[] = [];

  const settings = await getSettings();
  const recipients = effectiveRecipients(settings.notifyEmails);

  if (nowMin < hmToMinutes(settings.pollFrom)) {
    return {
      ranAt: now.toISOString(),
      ist: `${today} ${istTimeHm(now)}`,
      results: [{ scope: "all", action: "skip-hours" }],
    };
  }

  const configs = await prisma.monitorConfig.findMany({
    where: { pollEnabled: true },
    orderBy: { createdAt: "asc" },
  });

  // ── 1. Detect openings for every shop that hasn't opened yet ──────
  const states = new Map<string, DailyState>();
  for (const cfg of configs) {
    try {
      const state = await prisma.dailyMonitorState.upsert({
        where: { fpsId_date: { fpsId: cfg.fpsId, date: today } },
        create: { fpsId: cfg.fpsId, date: today },
        update: {},
      });
      states.set(cfg.fpsId, state);

      if (state.openedAt) {
        continue; // already known to be open
      }

      const txns = await getFpsTransactions(cfg.fpsId, month, year, today);
      const firstAt = firstLoginTime(txns);
      const updated = await prisma.dailyMonitorState.update({
        where: { id: state.id },
        data: {
          lastSeenTxnCount: txns.count,
          lastPolledAt: now,
          ...(txns.count > 0
            ? { openedAt: now, firstTxnAt: firstAt ?? null }
            : {}),
        },
      });
      states.set(cfg.fpsId, updated);
      results.push({
        scope: label(cfg),
        action: txns.count > 0 ? "opened-detected" : "polled",
        detail: `${txns.count} txns`,
      });
    } catch (err) {
      results.push({
        scope: label(cfg),
        action: "error",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  const digest = await prisma.dailyDigestState.upsert({
    where: { date: today },
    create: { date: today },
    update: {},
  });

  const digestConfigs = configs.filter((c) => !c.openedOverride);
  const eodDigestConfigs = configs.filter((c) => !c.eodOverride);

  // ── 2. Combined "shops opened" digest ────────────────────────────
  if (!digest.openedDigestSentAt && digestConfigs.length > 0) {
    const allOpened = digestConfigs.every(
      (c) => states.get(c.fpsId)?.openedAt,
    );
    const timeUp = nowMin >= hmToMinutes(settings.openedDigestTime);
    if (allOpened || timeUp) {
      const lines: ShopOpenedLine[] = [];
      for (const c of digestConfigs) {
        const s = states.get(c.fpsId);
        const t = s?.openedAt
          ? await getFpsTransactions(c.fpsId, month, year, today)
          : null;
        lines.push({
          label: label(c),
          fpsId: c.fpsId,
          openedAt: s?.firstTxnAt ? dateTime(s.firstTxnAt) : null,
          cards: t?.count ?? 0,
          commodities: (t?.byCommodity ?? []).map((x) => ({
            commodity: x.commodity,
            qty: x.qty,
          })),
        });
      }
      const res = await sendOpenedDigest(recipients, shortDate(today), lines);
      if (res.ok) {
        await prisma.dailyDigestState.update({
          where: { id: digest.id },
          data: { openedDigestSentAt: now },
        });
        results.push({
          scope: "opened-digest",
          action: "opened-digest-sent",
          detail: `${lines.length} shops`,
        });
      } else {
        results.push({
          scope: "opened-digest",
          action: "error",
          detail: res.error,
        });
      }
    }
  }

  // ── 3. Combined end-of-day digest ───────────────────────────────
  if (
    !digest.eodDigestSentAt &&
    eodDigestConfigs.length > 0 &&
    nowMin >= hmToMinutes(settings.eodDigestTime)
  ) {
    const lines: ShopEodLine[] = [];
    for (const c of eodDigestConfigs) {
      lines.push(await eodLine(c, month, year, today));
    }
    const res = await sendEodDigest(recipients, shortDate(today), lines);
    if (res.ok) {
      await prisma.dailyDigestState.update({
        where: { id: digest.id },
        data: { eodDigestSentAt: now },
      });
      results.push({
        scope: "eod-digest",
        action: "eod-digest-sent",
        detail: `${lines.length} shops`,
      });
    } else {
      results.push({ scope: "eod-digest", action: "error", detail: res.error });
    }
  }

  // ── 4. Per-shop overrides ───────────────────────────────────────
  for (const c of configs) {
    const s = states.get(c.fpsId);
    if (!s) {
      continue;
    }
    // opened override
    if (
      c.openedOverride &&
      s.openedAt &&
      !s.overrideOpenedSentAt &&
      nowMin >= hmToMinutes(c.openedOverride)
    ) {
      const t = await getFpsTransactions(c.fpsId, month, year, today);
      const res = await sendOpenedSingle(recipients, {
        label: label(c),
        fpsId: c.fpsId,
        openedAt: s.firstTxnAt ? dateTime(s.firstTxnAt) : "earlier today",
        cards: t.count,
        commodities: t.byCommodity.map((x) => ({
          commodity: x.commodity,
          qty: x.qty,
        })),
      });
      if (res.ok) {
        await prisma.dailyMonitorState.update({
          where: { id: s.id },
          data: { overrideOpenedSentAt: now },
        });
        results.push({
          scope: label(c),
          action: "opened-single-sent",
        });
      }
    }
    // eod override
    if (
      c.eodOverride &&
      !s.overrideEodSentAt &&
      nowMin >= hmToMinutes(c.eodOverride)
    ) {
      const line = await eodLine(c, month, year, today);
      const res = await sendEodSingle(recipients, shortDate(today), line);
      if (res.ok) {
        await prisma.dailyMonitorState.update({
          where: { id: s.id },
          data: { overrideEodSentAt: now },
        });
        results.push({ scope: label(c), action: "eod-single-sent" });
      }
    }
  }

  if (results.length === 0) {
    results.push({ scope: "all", action: "nothing" });
  }

  return {
    ranAt: now.toISOString(),
    ist: `${today} ${istTimeHm(now)}`,
    results,
  };
}

// ── helpers ───────────────────────────────────────────────────────

type Config = Awaited<
  ReturnType<typeof prisma.monitorConfig.findMany>
>[number];
type DailyState = Awaited<
  ReturnType<typeof prisma.dailyMonitorState.upsert>
>;

function label(c: Config): string {
  return c.label || c.fpsId;
}

function firstLoginTime(txns: {
  transactions: { loginTime: string }[];
}): string | undefined {
  return txns.transactions
    .map((t) => t.loginTime)
    .filter(Boolean)
    .sort()[0];
}

async function eodLine(
  c: Config,
  month: number,
  year: number,
  today: string,
): Promise<ShopEodLine> {
  const t = await getFpsTransactions(c.fpsId, month, year, today);
  const times = t.transactions
    .map((x) => x.loginTime)
    .filter(Boolean)
    .sort();
  return {
    label: label(c),
    fpsId: c.fpsId,
    txnCount: t.count,
    totalAmount: t.totalAmount,
    firstAt: times[0] ? dateTime(times[0]) : "—",
    lastAt: times[times.length - 1] ? dateTime(times[times.length - 1]) : "—",
    commodities: t.byCommodity.map((x) => ({
      commodity: x.commodity,
      qty: x.qty,
    })),
  };
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
