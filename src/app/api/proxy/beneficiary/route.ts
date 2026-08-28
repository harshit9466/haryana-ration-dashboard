import { z } from "zod";
import { getBeneficiary } from "@/lib/eposApi";
import { ok, fail, failFromError } from "@/lib/http";
import { currentMonthYear, readJson } from "@/lib/params";

const schema = z.object({
  srcNo: z
    .string()
    .trim()
    .regex(/^\d{10,14}$/, "Ration card (SRC) number must be 10–14 digits"),
  captcha: z.string().trim().min(1, "Enter the captcha"),
  salt: z.string().trim().min(1, "Refresh the captcha (salt missing)"),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2035).optional(),
});

/**
 * API 6 — Beneficiary (ration card) details. Requires a captcha.
 * POST /api/proxy/beneficiary
 *   body: { srcNo, captcha, salt, month?, year? }
 * Wrong captcha → 400 "Captcha Invalid" (the UI then requests a new captcha).
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const now = currentMonthYear();
  const { srcNo, captcha, salt } = parsed.data;
  const month = parsed.data.month ?? now.month;
  const year = parsed.data.year ?? now.year;

  try {
    const result = await getBeneficiary(srcNo, month, year, captcha, salt);
    if (!result.ok) {
      return fail(result.message, 400, { retryCaptcha: true });
    }
    return ok(result);
  } catch (err) {
    return failFromError(err);
  }
}
