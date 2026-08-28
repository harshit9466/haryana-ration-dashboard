import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, failFromError } from "@/lib/http";
import { readJson } from "@/lib/params";
import { monitorConfigInput } from "@/lib/monitorSchema";

/** GET /api/admin/config — saari monitored FPS. */
export async function GET() {
  try {
    const list = await prisma.monitorConfig.findMany({
      orderBy: { createdAt: "asc" },
    });
    return ok(list);
  } catch (err) {
    return failFromError(err, 500);
  }
}

/** POST /api/admin/config — create ya update (fpsId natural key). */
export async function POST(req: Request) {
  const parsed = monitorConfigInput.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const data = parsed.data;
  try {
    const saved = await prisma.monitorConfig.upsert({
      where: { fpsId: data.fpsId },
      create: data,
      update: {
        label: data.label,
        distCode: data.distCode,
        emails: data.emails,
        shopOpen: data.shopOpen,
        shopClose: data.shopClose,
        eodTime: data.eodTime,
        pollEnabled: data.pollEnabled,
      },
    });
    return ok(saved);
  } catch (err) {
    return failFromError(err, 500);
  }
}

/** DELETE /api/admin/config?fpsId=... */
export async function DELETE(req: NextRequest) {
  const fpsId = req.nextUrl.searchParams.get("fpsId");
  if (!fpsId) {
    return fail("fpsId chahiye", 400);
  }
  try {
    await prisma.monitorConfig.delete({ where: { fpsId } });
    await prisma.dailyMonitorState.deleteMany({ where: { fpsId } });
    return ok({ deleted: fpsId });
  } catch (err) {
    return failFromError(err, 500);
  }
}
