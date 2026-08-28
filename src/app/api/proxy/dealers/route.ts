import type { NextRequest } from "next/server";
import { getDealers } from "@/lib/eposApi";
import { env } from "@/lib/env";
import { ok, failFromError } from "@/lib/http";

/**
 * API 5 — Dealer Details (master list). Poore district ki FPS + dealer naam.
 * GET /api/proxy/dealers?dist=073   (dist optional, default env)
 * 24h cached — ye list roz nahi badalti.
 */
export async function GET(req: NextRequest) {
  const distCode = req.nextUrl.searchParams.get("dist") || env().DEFAULT_DIST_CODE;
  try {
    return ok(await getDealers(distCode));
  } catch (err) {
    return failFromError(err);
  }
}
