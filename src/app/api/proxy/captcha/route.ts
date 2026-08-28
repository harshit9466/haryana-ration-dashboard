import { getCaptcha } from "@/lib/eposApi";
import { ok, failFromError } from "@/lib/http";

/**
 * API 7 — Captcha image for the beneficiary lookup.
 * GET /api/proxy/captcha  →  { imageDataUri, salt }
 * Keep the `salt` and send it with the beneficiary call.
 */
export async function GET() {
  try {
    return ok(await getCaptcha());
  } catch (err) {
    return failFromError(err);
  }
}
