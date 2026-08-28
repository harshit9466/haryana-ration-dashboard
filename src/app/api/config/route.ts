import { env } from "@/lib/env";
import { ok } from "@/lib/http";

/**
 * Non-secret defaults jo frontend prefill karta hai.
 * (Secrets — ADMIN_PASSWORD, RESEND_API_KEY, CRON_SECRET — kabhi yahan nahi.)
 */
export async function GET() {
  return ok({
    distCode: env().DEFAULT_DIST_CODE,
    afsoCode: env().DEFAULT_AFSO_CODE,
    defaultSrcNo: env().DEFAULT_SRC_NO,
  });
}
