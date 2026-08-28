import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { qty, rupees } from "@/lib/format";

/**
 * Email — Resend REST (`POST https://api.resend.com/emails`), bilkul FlowTrack jaisा.
 * `from` = onboarding@resend.dev (shared sender — sirf account-owner email pe jaata hai).
 * Har send `email_log` me record hota hai.
 */

const RESEND_URL = "https://api.resend.com/emails";

export type SendResult = { ok: boolean; error?: string };

async function send(
  to: string[],
  subject: string,
  html: string,
  kind: string,
  fpsId?: string,
): Promise<SendResult> {
  const apiKey = env().RESEND_API_KEY;
  const from = env().EMAIL_FROM;

  if (!apiKey) {
    const error = "RESEND_API_KEY set nahi hai";
    await logEmail(to, subject, false, error, kind, fpsId);
    return { ok: false, error };
  }
  if (to.length === 0) {
    return { ok: false, error: "Koi recipient nahi" };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
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
      data: { to: to.join(", "), subject, ok, error, kind, fpsId: fpsId ?? null },
    });
  } catch {
    // logging fail ho to bhi email flow na toote
  }
}

// ── shared shell ──────────────────────────────────────────────────
function shell(body: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">${body}<p style="color:#94a3b8;font-size:12px;margin-top:24px">Haryana Ration Dashboard · automated</p></div>`;
}

// ── test ──────────────────────────────────────────────────────────
export function sendTestEmail(to: string[]): Promise<SendResult> {
  return send(
    to,
    "Ration Dashboard — test email ✅",
    shell(
      `<h2 style="margin:0 0 8px">Test email aaya 🎉</h2><p>Agar ye mila, matlab Resend theek se configured hai. Monitor alerts isi tarah aayenge.</p>`,
    ),
    "test",
  );
}

// ── start of day ─────────────────────────────────────────────────
export type StartMailData = {
  fpsId: string;
  label: string;
  firstTxnAt: string; // "HH:mm:ss" ya display string
  cards: number;
  commodities: { commodity: string; qty: number }[];
};

export function sendStartEmail(
  to: string[],
  d: StartMailData,
): Promise<SendResult> {
  const items =
    d.commodities
      .filter((c) => c.qty)
      .map((c) => `${c.commodity} ${qty(c.qty)}`)
      .join(", ") || "abhi kuch issue nahi";
  return send(
    to,
    `🟢 ${d.label || d.fpsId} ne aaj ration dena shuru kiya`,
    shell(
      `<h2 style="margin:0 0 8px">🟢 Shop khul gayi</h2>
       <p><strong>${d.label || "FPS"}</strong> (${d.fpsId}) ne aaj pehli transaction ${d.firstTxnAt} pe ki.</p>
       <p>Ab tak: <strong>${d.cards}</strong> card${d.cards === 1 ? "" : "s"} · ${items}</p>`,
    ),
    "start",
    d.fpsId,
  );
}

// ── end of day ───────────────────────────────────────────────────
export type EodMailData = {
  fpsId: string;
  label: string;
  date: string; // display date
  txnCount: number;
  totalAmount: number;
  firstAt: string;
  lastAt: string;
  commodities: { commodity: string; qty: number }[];
};

export function sendEodEmail(to: string[], d: EodMailData): Promise<SendResult> {
  const rows = d.commodities
    .filter((c) => c.qty)
    .map(
      (c) =>
        `<tr><td style="padding:2px 12px 2px 0">${c.commodity}</td><td style="padding:2px 0;text-align:right"><strong>${qty(c.qty)}</strong></td></tr>`,
    )
    .join("");
  return send(
    to,
    `📊 ${d.label || d.fpsId} — aaj ka hisaab (${d.date})`,
    shell(
      `<h2 style="margin:0 0 8px">📊 Din khatam — ${d.date}</h2>
       <p><strong>${d.label || "FPS"}</strong> (${d.fpsId})</p>
       <p><strong>${d.txnCount}</strong> transactions · ${rupees(d.totalAmount)} · ${d.firstAt} → ${d.lastAt}</p>
       <table style="border-collapse:collapse;margin-top:8px">${rows || "<tr><td>Koi sale nahi</td></tr>"}</table>`,
    ),
    "eod",
    d.fpsId,
  );
}
