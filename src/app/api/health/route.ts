import { ok } from "@/lib/http";

/** Railway health check + "app zinda hai?" ke liye. */
export async function GET() {
  return ok({
    status: "up",
    time: new Date().toISOString(),
    tz: process.env.TZ ?? "(unset)",
  });
}
