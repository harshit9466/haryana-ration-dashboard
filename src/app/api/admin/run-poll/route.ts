import { runPoll } from "@/lib/monitor";
import { ok, failFromError } from "@/lib/http";

/**
 * POST /api/admin/run-poll — run one poll cycle now (the manual "Check now").
 * Behind the site password (no CRON_SECRET needed here).
 */
export async function POST() {
  try {
    return ok(await runPoll());
  } catch (err) {
    return failFromError(err, 500);
  }
}
