import { z } from "zod";
import { getFpsTransactions } from "@/lib/eposApi";
import { ok, fail, failFromError } from "@/lib/http";
import { currentMonthYear, fpsMonthYear, readJson } from "@/lib/params";

const schema = fpsMonthYear.extend({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be "YYYY-MM-DD"')
    .optional(),
});

/**
 * API 4 — FPS-wise Transactions (har ek transaction + aggregates).
 * POST /api/proxy/transactions   body: { fpsId, month?, year?, date? }
 * Pass `date` for a single day only (the government returns the whole month — 1000+ rows).
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const now = currentMonthYear();
  const parsed = schema.safeParse({ ...now, ...(body as object) });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { fpsId, month, year, date } = parsed.data;
  try {
    return ok(await getFpsTransactions(fpsId, month, year, date));
  } catch (err) {
    return failFromError(err);
  }
}
