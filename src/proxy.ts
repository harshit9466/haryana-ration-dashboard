import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next 16: "middleware" is now "proxy". Optional site-wide password (HTTP Basic).
 * Any username — password = ADMIN_PASSWORD.
 *
 * - ADMIN_PASSWORD **blank/unset → site fully open** (current state). Set the env
 *   var on Railway later → auth on, no code change needed.
 * - `/api/cron/poll` and `/api/health` are always exempt (see config.matcher).
 */
export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD ?? "";

  // not configured → allow (don't lock the owner out)
  if (!password) {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const supplied = decoded.slice(decoded.indexOf(":") + 1);
      if (supplied === password) {
        return NextResponse.next();
      }
    } catch {
      // malformed header → falls through to 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Ration Dashboard"' },
  });
}

export const config = {
  // sab kuch chhod ke: cron endpoint, health check (Railway), next internals, favicon
  matcher: [
    "/((?!api/cron/poll|api/health|_next/static|_next/image|favicon.ico).*)",
  ],
};
