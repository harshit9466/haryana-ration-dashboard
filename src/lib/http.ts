import { NextResponse } from "next/server";

/**
 * Common response envelope for route handlers.
 *   success → { ok: true, data }
 *   failure → { ok: false, error }
 */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  error: string,
  status = 400,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

/** Upstream (govt API) failure or our own validation — one place to log + respond. */
export function failFromError(err: unknown, status = 502): NextResponse {
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[route error]", message);
  return fail(message, status);
}
