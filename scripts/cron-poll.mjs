// Entrypoint for the Railway "cron" service.
// Schedule is set in Railway service settings (every 15 min) — not here. It's just
// a heartbeat; which report times fire is entirely DB-driven (admin Settings).
// Job: call the web service's /api/cron/poll, then exit.
//
// Env:
//   WEB_URL      — web service public URL
//   CRON_SECRET  — same value as the web service

const webUrl = process.env.WEB_URL?.replace(/\/$/, "");
const secret = process.env.CRON_SECRET;

if (!webUrl || !secret) {
  console.error("cron-poll: WEB_URL / CRON_SECRET missing");
  process.exit(1);
}

const url = `${webUrl}/api/cron/poll`;
const started = Date.now();

async function attempt(n) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  console.log(`cron-poll ok (try ${n}, ${Date.now() - started}ms): ${body.slice(0, 400)}`);
}

let lastErr;
for (let i = 1; i <= 3; i++) {
  try {
    await attempt(i);
    process.exit(0);
  } catch (err) {
    lastErr = err;
    console.warn(`cron-poll try ${i} failed: ${err.message}`);
    await new Promise((r) => setTimeout(r, i * 3000));
  }
}

console.error(`cron-poll: all retries failed — ${lastErr?.message}`);
process.exit(1);
