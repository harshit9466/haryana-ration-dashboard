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

export type ShopSnapshot = {
  label: string;
  fpsId: string;
  opened: boolean;
  firstTxnAt: string | null; // display time, or null
  cards: number;
  totalAmount: number;
  commodities: { commodity: string; qty: number }[];
  error?: string;
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

function commodityText(items: { commodity: string; qty: number }[]): string {
  const nonZero = items.filter((c) => c.qty);
  return nonZero.length
    ? nonZero.map((c) => `${c.commodity} ${qty(c.qty)}`).join(", ")
    : "—";
}

function shopCard(s: ShopSnapshot): string {
  const head = `<div style="font-weight:600">${s.label} <span style="color:#94a3b8;font-weight:400;font-size:12px">${s.fpsId}</span></div>`;
  let body: string;
  if (s.error) {
    body = `<div style="color:#b45309">⚠️ couldn't check — ${s.error}</div>`;
  } else if (s.opened) {
    body = `<div style="color:#15803d">🟢 open${s.firstTxnAt ? ` since ${s.firstTxnAt}` : ""} · ${plural(s.cards, "card")} · ${rupees(s.totalAmount)}</div>
      <div style="color:#475569;font-size:13px">${commodityText(s.commodities)}</div>`;
  } else {
    body = `<div style="color:#94a3b8">⏳ not open yet</div>`;
  }
  return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:8px 0">${head}${body}</div>`;
}

// ── status report ─────────────────────────────────────────────────
export function sendStatusReport(
  to: string[],
  data: { dateStr: string; atTime: string; shops: ShopSnapshot[] },
): Promise<SendResult> {
  const openCount = data.shops.filter((s) => s.opened).length;
  const oneFps =
    data.shops.length === 1 ? data.shops[0].fpsId : undefined;
  return send(
    to,
    `🌾 Ration status @ ${data.atTime} — ${openCount}/${data.shops.length} open (${data.dateStr})`,
    shell(
      `<h2 style="margin:0 0 4px">Status at ${data.atTime} — ${data.dateStr}</h2>
       <p style="color:#475569;margin-top:0">${openCount} of ${plural(data.shops.length, "shop")} open.</p>
       ${data.shops.map(shopCard).join("")}`,
    ),
    "report",
    oneFps,
  );
}

// ── test ──────────────────────────────────────────────────────────
export function sendTestEmail(to: string[]): Promise<SendResult> {
  return send(
    to,
    "Ration Dashboard — test email ✅",
    shell(
      `<h2 style="margin:0 0 8px">Test email received 🎉</h2><p>If you got this, Resend is configured correctly. Status reports will arrive the same way.</p>`,
    ),
    "test",
  );
}
