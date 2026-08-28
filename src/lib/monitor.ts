import { prisma } from "@/lib/db";
import { getFpsTransactions } from "@/lib/eposApi";
import { sendStartEmail, sendEodEmail } from "@/lib/mailer";
import { currentMonthYear } from "@/lib/params";
import { dateTime, shortDate } from "@/lib/format";
import { istDateKey, istTimeHm, hmToMinutes } from "@/lib/normalize";

/**
 * Ek poll cycle. Cron service har ~15 min `/api/cron/poll` hit karti hai jo isko chalata hai.
 *
 * Har monitored FPS ke liye:
 *   - shop hours ke bahar → kuch nahi (koi govt call nahi)
 *   - start detect: aaj ki pehli transaction dikhi + start-mail nahi gayi → mail bhejo
 *   - EOD: eodTime ho gaya + start-mail gayi + eod-mail nahi gayi → summary bhejo
 * Idempotent — DB flags (`startEmailSentAt`, `eodEmailSentAt`) se duplicate mail nahi jaati.
 */

export type PollOutcome = {
  fpsId: string;
  label: string;
  action: "skip-hours" | "skip-done" | "polled" | "start-sent" | "eod-sent" | "error";
  detail?: string;
};

export async function runPoll(): Promise<{
  ranAt: string;
  ist: string;
  results: PollOutcome[];
}> {
  const now = new Date();
  const today = istDateKey(now);
  const nowHm = istTimeHm(now);
  const nowMin = hmToMinutes(nowHm);
  const { month, year } = currentMonthYear();

  const configs = await prisma.monitorConfig.findMany({
    where: { pollEnabled: true },
  });

  const results: PollOutcome[] = [];

  for (const cfg of configs) {
    const label = cfg.label || cfg.fpsId;
    try {
      results.push(
        await pollOne(cfg, { today, nowMin, month, year, label }),
      );
    } catch (err) {
      results.push({
        fpsId: cfg.fpsId,
        label,
        action: "error",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return { ranAt: now.toISOString(), ist: `${today} ${nowHm}`, results };
}

type Cfg = Awaited<ReturnType<typeof prisma.monitorConfig.findMany>>[number];

async function pollOne(
  cfg: Cfg,
  ctx: {
    today: string;
    nowMin: number;
    month: number;
    year: number;
    label: string;
  },
): Promise<PollOutcome> {
  const { today, nowMin, month, year, label } = ctx;
  const openMin = hmToMinutes(cfg.shopOpen);
  const eodMin = hmToMinutes(cfg.eodTime);

  // shop khulne se pehle → kuch nahi
  if (nowMin < openMin) {
    return { fpsId: cfg.fpsId, label, action: "skip-hours" };
  }

  const state = await prisma.dailyMonitorState.upsert({
    where: { fpsId_date: { fpsId: cfg.fpsId, date: today } },
    create: { fpsId: cfg.fpsId, date: today },
    update: {},
  });

  const startDone = state.startEmailSentAt !== null;
  const eodDone = state.eodEmailSentAt !== null;
  const eodTime = nowMin >= eodMin;

  // sab ho chuka
  if (eodDone) {
    return { fpsId: cfg.fpsId, label, action: "skip-done" };
  }
  // start ho chuki, EOD ka time nahi hua → wait
  if (startDone && !eodTime) {
    return { fpsId: cfg.fpsId, label, action: "skip-done", detail: "start sent, waiting for EOD" };
  }

  // yahan tak aaye = ya to start detect karni hai, ya EOD bhejni hai → govt se aaj ka data
  const txns = await getFpsTransactions(cfg.fpsId, month, year, today);
  const emails = cfg.emails;

  const times = txns.transactions
    .map((t) => t.loginTime)
    .filter(Boolean)
    .sort();

  // ── EOD summary ──
  if (startDone && eodTime && !eodDone) {
    const res = await sendEodEmail(emails, {
      fpsId: cfg.fpsId,
      label,
      date: shortDate(today),
      txnCount: txns.count,
      totalAmount: txns.totalAmount,
      firstAt: times[0] ? dateTime(times[0]) : "—",
      lastAt: times[times.length - 1] ? dateTime(times[times.length - 1]) : "—",
      commodities: txns.byCommodity.map((c) => ({
        commodity: c.commodity,
        qty: c.qty,
      })),
    });
    await prisma.dailyMonitorState.update({
      where: { id: state.id },
      data: {
        // mail fail hui to flag mat set karo — agli poll retry karegi
        eodEmailSentAt: res.ok ? new Date() : null,
        lastSeenTxnCount: txns.count,
        lastPolledAt: new Date(),
      },
    });
    return {
      fpsId: cfg.fpsId,
      label,
      action: res.ok ? "eod-sent" : "error",
      detail: res.ok ? `${txns.count} txns` : `EOD mail fail: ${res.error}`,
    };
  }

  // ── start of day ──
  if (!startDone && txns.count > 0) {
    const firstTime = times[0];
    const res = await sendStartEmail(emails, {
      fpsId: cfg.fpsId,
      label,
      firstTxnAt: firstTime ? dateTime(firstTime) : "abhi",
      cards: txns.count,
      commodities: txns.byCommodity.map((c) => ({
        commodity: c.commodity,
        qty: c.qty,
      })),
    });
    await prisma.dailyMonitorState.update({
      where: { id: state.id },
      data: {
        startEmailSentAt: res.ok ? new Date() : null,
        firstTxnAt: firstTime ?? null,
        lastSeenTxnCount: txns.count,
        lastPolledAt: new Date(),
      },
    });
    return {
      fpsId: cfg.fpsId,
      label,
      action: res.ok ? "start-sent" : "error",
      detail: res.ok ? `${txns.count} txns` : `start mail fail: ${res.error}`,
    };
  }

  // koi transaction nahi abhi — bas polled
  await prisma.dailyMonitorState.update({
    where: { id: state.id },
    data: { lastSeenTxnCount: txns.count, lastPolledAt: new Date() },
  });
  return { fpsId: cfg.fpsId, label, action: "polled", detail: `${txns.count} txns` };
}
