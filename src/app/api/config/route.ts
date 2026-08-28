import { env } from "@/lib/env";
import { ok } from "@/lib/http";

/**
 * Non-secret defaults the frontend uses to prefill inputs.
 * (Secrets — ADMIN_PASSWORD, RESEND_API_KEY, CRON_SECRET — are never returned here.)
 */
export async function GET() {
  return ok({
    distCode: env().DEFAULT_DIST_CODE,
    afsoCode: env().DEFAULT_AFSO_CODE,
    defaultSrcNo: env().DEFAULT_SRC_NO,
    notifyEmail: env().NOTIFY_EMAIL,
  });
}
