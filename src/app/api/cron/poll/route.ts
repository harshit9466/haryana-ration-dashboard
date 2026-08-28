import { headers } from "next/headers";
import { runPoll } from "@/lib/monitor";
import { env } from "@/lib/env";
import { ok, fail, failFromError } from "@/lib/http";

/**
 * Monitor poll. The Railway "cron" service hits this every ~2 hours.
 * EXEMPT from the site password — uses `Authorization: Bearer ${CRON_SECRET}` instead.
 *
 * Both GET and POST work (curl defaults to GET).
 */
async function handle(): Promise<Response> {
  const secret = env().CRON_SECRET;
  if (!secret) {
    return fail("CRON_SECRET is not set — poll disabled", 503);
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
