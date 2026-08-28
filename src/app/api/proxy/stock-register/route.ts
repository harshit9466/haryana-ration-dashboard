import { getStockRegister } from "@/lib/eposApi";
import { ok, fail, failFromError } from "@/lib/http";
import { currentMonthYear, fpsMonthYear, readJson } from "@/lib/params";

/**
 * API 2 — FPS Stock Register (commodity-wise OB / received / issued / CB).
 * POST /api/proxy/stock-register   body: { fpsId, month?, year? }
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const now = currentMonthYear();
  const parsed = fpsMonthYear.safeParse({ ...now, ...(body as object) });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { fpsId, month, year } = parsed.data;
  try {
    return ok(await getStockRegister(fpsId, month, year));
  } catch (err) {
    return failFromError(err);
  }
}
