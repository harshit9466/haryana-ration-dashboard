import { runPoll } from "@/lib/monitor";
import { ok, failFromError } from "@/lib/http";

/**
 * POST /api/admin/run-poll — abhi ek poll cycle chalao (manual "check now").
 * Site-password ke peeche hai (cron wala CRON_SECRET yahan nahi chahiye).
 */
export async function POST() {
  try {
    return ok(await runPoll());
  } catch (err) {
    return failFromError(err, 500);
  }
}
