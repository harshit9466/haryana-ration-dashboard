import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next 16: "middleware" ab "proxy" hai. Optional site-wide password (HTTP Basic).
 * Username kuch bhi — password = ADMIN_PASSWORD.
 *
 * - ADMIN_PASSWORD **blank/unset → site fully open** (abhi yahi hai). Baad me
 *   Railway pe env var set karo → auth on, koi code change nahi.
 * - `/api/cron/poll` aur `/api/health` hamesha exempt (config.matcher me).
 */
export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD ?? "";

  // configured hi nahi → allow (owner khud ko lock out na kare)
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
      // malformed header → neeche 401
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
