import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/monitor";
import { env } from "@/lib/env";
import { ok, fail, failFromError } from "@/lib/http";
import { readJson } from "@/lib/params";
import { settingsInput } from "@/lib/monitorSchema";

/** GET /api/admin/settings — global monitor settings. */
export async function GET() {
  try {
    const s = await getSettings();
    return ok({
      notifyEmails:
        s.notifyEmails.length > 0
          ? s.notifyEmails
          : env().NOTIFY_EMAIL
            ? [env().NOTIFY_EMAIL]
            : [],
      reportTimes: s.reportTimes,
    });
  } catch (err) {
    return failFromError(err, 500);
  }
}

/** POST /api/admin/settings — update global settings. */
export async function POST(req: Request) {
  const parsed = settingsInput.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  try {
    await getSettings(); // ensure the row exists
    const saved = await prisma.settings.update({
      where: { id: 1 },
      data: parsed.data,
    });
    return ok(saved);
  } catch (err) {
    return failFromError(err, 500);
  }
}
