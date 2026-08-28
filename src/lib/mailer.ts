import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { qty, rupees } from "@/lib/format";

/**
 * Email via the Resend REST API (POST https://api.resend.com/emails), same as
 * the FlowTrack project. Sender is onboarding@resend.dev (shared sender — only
 * delivers to the Resend account owner's address). Every send is logged to
 * email_log.
 *
 * Set MAILER_DEV_NOOP=1 to skip the actual send (logs only) for local testing.
 */

const RESEND_URL = "https://api.resend.com/emails";

export type SendResult = { ok: boolean; error?: string };

export type Commodity = { commodity: string; qty: number };

export type ShopOpenedLine = {
  label: string;
  fpsId: string;
  openedAt: string | null; // display time, or null if not opened
  cards: number;
  commodities: Commodity[];
};

export type ShopEodLine = {
  label: string;
  fpsId: string;
  txnCount: number;
  totalAmount: number;
  firstAt: string;
  lastAt: string;
  commodities: Commodity[];
};

async function send(
  to: string[],
  subject: string,
  html: string,
  kind: string,
  fpsId?: string,
): Promise<SendResult> {
  if (to.length === 0) {
    return { ok: false, error: "no recipients" };
  }

  if (env().MAILER_DEV_NOOP === "1") {
    await logEmail(to, subject, true, "(dev noop — not sent)", kind, fpsId);
    return { ok: true };
  }

  const apiKey = env().RESEND_API_KEY;
  if (!apiKey) {
    const error = "RESEND_API_KEY is not set";
    await logEmail(to, subject, false, error, kind, fpsId);
    return { ok: false, error };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env().EMAIL_FROM, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const error = `Resend HTTP ${res.status} ${body.slice(0, 200)}`;
      await logEmail(to, subject, false, error, kind, fpsId);
      return { ok: false, error };
    }
    await logEmail(to, subject, true, null, kind, fpsId);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "send failed";
    await logEmail(to, subject, false, error, kind, fpsId);
    return { ok: false, error };
  }
}

async function logEmail(
  to: string[],
  subject: string,
  ok: boolean,
  error: string | null,
  kind: string,
  fpsId?: string,
): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        to: to.join(", "),
        subject,
        ok,
        error,
        kind,
        fpsId: fpsId ?? null,
      },
    });
  } catch {
    // never let logging failure break the email flow
  }
}

// ── templates ─────────────────────────────────────────────────────

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function shell(body: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:620px;margin:0 auto;color:#1e293b;font-size:14px;line-height:1.5">${body}<p style="color:#94a3b8;font-size:12px;margin-top:28px">Haryana Ration Dashboard · automated</p></div>`;
}

function commodityText(items: Commodity[]): string {
  const nonZero = items.filter((c) => c.qty);
  return nonZero.length
    ? nonZero.map((c) => `${c.commodity} ${qty(c.qty)}`).join(", ")
    : "—";
}

function openedCard(s: ShopOpenedLine): string {
  return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:8px 0">
    <div style="font-weight:600">${s.label} <span style="color:#94a3b8;font-weight:400;font-size:12px">${s.fpsId}</span></div>
    ${
      s.openedAt
        ? `<div style="color:#15803d">🟢 opened ${s.openedAt} · ${plural(s.cards, "card")} so far</div>
           <div style="color:#475569;font-size:13px">${commodityText(s.commodities)}</div>`
        : `<div style="color:#b45309">⏳ not opened yet</div>`
    }
  </div>`;
}

function eodCard(s: ShopEodLine): string {
  const rows = s.commodities
    .filter((c) => c.qty)
    .map(
      (c) =>
        `<tr><td style="padding:1px 14px 1px 0;color:#475569">${c.commodity}</td><td style="padding:1px 0;text-align:right"><strong>${qty(c.qty)}</strong></td></tr>`,
    )
    .join("");
  return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:8px 0">
    <div style="font-weight:600">${s.label} <span style="color:#94a3b8;font-weight:400;font-size:12px">${s.fpsId}</span></div>
    <div style="color:#475569">${s.txnCount} transactions · ${rupees(s.totalAmount)} · ${s.firstAt} → ${s.lastAt}</div>
    <table style="border-collapse:collapse;margin-top:6px">${rows || '<tr><td style="color:#94a3b8">no sales</td></tr>'}</table>
  </div>`;
}

// ── test ──────────────────────────────────────────────────────────
export function sendTestEmail(to: string[]): Promise<SendResult> {
  return send(
    to,
    "Ration Dashboard — test email ✅",
    shell(
      `<h2 style="margin:0 0 8px">Test email received 🎉</h2><p>If you got this, Resend is configured correctly. Monitor alerts will arrive the same way.</p>`,
    ),
    "test",
  );
}

// ── combined "shops opened" digest ───────────────────────────────
export function sendOpenedDigest(
  to: string[],
  dateStr: string,
  shops: ShopOpenedLine[],
): Promise<SendResult> {
  const openCount = shops.filter((s) => s.openedAt).length;
  return send(
    to,
    `🟢 Ration update — ${openCount}/${shops.length} shops open (${dateStr})`,
    shell(
      `<h2 style="margin:0 0 4px">Shops open today — ${dateStr}</h2>
       <p style="color:#475569;margin-top:0">${openCount} of ${plural(shops.length, "monitored shop")} have started giving ration.</p>
       ${shops.map(openedCard).join("")}`,
    ),
    "opened-digest",
  );
}

// ── combined end-of-day digest ──────────────────────────────────
export function sendEodDigest(
  to: string[],
  dateStr: string,
  shops: ShopEodLine[],
): Promise<SendResult> {
  const totalTxns = shops.reduce((a, s) => a + s.txnCount, 0);
  const totalAmt = shops.reduce((a, s) => a + s.totalAmount, 0);
  return send(
    to,
    `📊 End of day — ${plural(shops.length, "shop")}, ${plural(totalTxns, "transaction")} (${dateStr})`,
    shell(
      `<h2 style="margin:0 0 4px">End of day — ${dateStr}</h2>
       <p style="color:#475569;margin-top:0">Across ${plural(shops.length, "shop")}: ${plural(totalTxns, "transaction")} · ${rupees(totalAmt)}</p>
       ${shops.map(eodCard).join("")}`,
    ),
    "eod-digest",
  );
}

// ── per-shop override emails ────────────────────────────────────
export function sendOpenedSingle(
  to: string[],
  shop: ShopOpenedLine,
): Promise<SendResult> {
  return send(
    to,
    `🟢 ${shop.label} started giving ration today`,
    shell(
      `<h2 style="margin:0 0 8px">🟢 ${shop.label} is open</h2>
       <p>First transaction at ${shop.openedAt}. ${plural(shop.cards, "card")} so far · ${commodityText(shop.commodities)}</p>`,
    ),
    "opened",
    shop.fpsId,
  );
}

export function sendEodSingle(
  to: string[],
  dateStr: string,
  shop: ShopEodLine,
): Promise<SendResult> {
  return send(
    to,
    `📊 ${shop.label} — end of day (${dateStr})`,
    shell(
      `<h2 style="margin:0 0 4px">${shop.label} — ${dateStr}</h2>${eodCard(shop)}`,
    ),
    "eod",
    shop.fpsId,
  );
}
