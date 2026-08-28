import { headers } from "next/headers";
import { runPoll } from "@/lib/monitor";
import { env } from "@/lib/env";
import { ok, fail, failFromError } from "@/lib/http";

/**
 * Monitor poll. Cron service har ~15 min isko hit karti hai.
 * Site-password se EXEMPT — iske badle `Authorization: Bearer ${CRON_SECRET}`.
 *
 * GET aur POST dono chalte hain (curl default GET).
 */
async function handle(): Promise<Response> {
  const secret = env().CRON_SECRET;
  if (!secret) {
    return fail("CRON_SECRET set nahi hai — poll disabled", 503);
  }
  const auth = (await headers()).get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return fail("Unauthorized", 401);
  }

  try {
    const summary = await runPoll();
    return ok(summary);
  } catch (err) {
    return failFromError(err, 500);
  }
}

export const GET = handle;
export const POST = handle;
