import { getDateWiseTransactions } from "@/lib/eposApi";
import { env } from "@/lib/env";
import { ok, fail, failFromError } from "@/lib/http";
import { currentMonthYear, fpsMonthYearDist, readJson } from "@/lib/params";

/**
 * API 3 — Date-wise Transactions (din-b-din sale + cards served).
 * POST /api/proxy/date-wise   body: { fpsId, distCode?, month?, year? }
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const now = currentMonthYear();
  const parsed = fpsMonthYearDist.safeParse({ ...now, ...(body as object) });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { fpsId, month, year } = parsed.data;
  const distCode = parsed.data.distCode || env().DEFAULT_DIST_CODE;
  try {
    return ok(await getDateWiseTransactions(fpsId, distCode, month, year));
  } catch (err) {
    return failFromError(err);
  }
}
