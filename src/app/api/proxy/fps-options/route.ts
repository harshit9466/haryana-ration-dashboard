import type { NextRequest } from "next/server";
import { getFpsOptions } from "@/lib/eposApi";
import { env } from "@/lib/env";
import { ok, failFromError } from "@/lib/http";

/**
 * API 1 — FPS list for one AFSO sub-office (HTML <option> tags parsed).
 * GET /api/proxy/fps-options?dist=073&afso=15019   (both optional, default from env)
 * Secondary source — primary master list /api/proxy/dealers hai.
 */
export async function GET(req: NextRequest) {
  const distCode =
    req.nextUrl.searchParams.get("dist") || env().DEFAULT_DIST_CODE;
  const afsoCode =
    req.nextUrl.searchParams.get("afso") || env().DEFAULT_AFSO_CODE;
  try {
    const options = await getFpsOptions(distCode, afsoCode);
    return ok({ distCode, afsoCode, count: options.length, options });
  } catch (err) {
    return failFromError(err);
  }
}
