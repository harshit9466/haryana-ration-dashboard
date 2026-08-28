import { ok } from "@/lib/http";

/** Railway health check + a quick "is the app up?" probe. */
export async function GET() {
  return ok({
    status: "up",
    time: new Date().toISOString(),
    tz: process.env.TZ ?? "(unset)",
  });
}
