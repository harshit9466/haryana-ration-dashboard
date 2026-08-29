import { runPoll } from "@/lib/monitor";
import { ok, failFromError } from "@/lib/http";

/**
 * POST /api/admin/report-now — send a status report right now for every scope,
 * regardless of the configured report times. Does not mark any time as sent.
 * Behind the site password.
 */
export async function POST() {
  try {
    return ok(await runPoll({ force: true }));
  } catch (err) {
    return failFromError(err, 500);
  }
}
