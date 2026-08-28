import { getCaptcha } from "@/lib/eposApi";
import { ok, failFromError } from "@/lib/http";

/**
 * API 7 — Captcha image for the beneficiary lookup.
 * GET /api/proxy/captcha  →  { imageDataUri, salt }
 * `salt` ko yaad rakho, beneficiary call ke saath bhejo.
 */
export async function GET() {
  try {
    return ok(await getCaptcha());
  } catch (err) {
    return failFromError(err);
  }
}
