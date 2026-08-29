import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, failFromError } from "@/lib/http";
import { readJson } from "@/lib/params";
import { monitorConfigInput, bulkAddInput } from "@/lib/monitorSchema";
import { istDateKey } from "@/lib/normalize";

/** GET /api/admin/config — all monitored shops + today's monitor state + today's sent reports. */
export async function GET() {
  try {
    const list = await prisma.monitorConfig.findMany({
      orderBy: { createdAt: "asc" },
    });
    const today = istDateKey();
    const [states, reportStates] = await Promise.all([
      prisma.dailyMonitorState.findMany({
        where: { date: today, fpsId: { in: list.map((c) => c.fpsId) } },
      }),
      prisma.dailyReportState.findMany({ where: { date: today } }),
    ]);
    const byFps = new Map(states.map((s) => [s.fpsId, s]));
    const sentByScope = new Map(
      reportStates.map((r) => [r.scope, r.sentTimes]),
    );

    return ok({
      globalReportsSent: sentByScope.get("global") ?? [],
      shops: list.map((c) => {
        const s = byFps.get(c.fpsId);
        return {
          ...c,
          reportsSent: sentByScope.get(c.fpsId) ?? [],
          today: s
            ? {
                openedAt: s.openedAt,
                firstTxnAt: s.firstTxnAt,
                lastSeenTxnCount: s.lastSeenTxnCount,
                lastPolledAt: s.lastPolledAt,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    return failFromError(err, 500);
  }
}

/**
 * POST /api/admin/config
 *  - { shops: [{fpsId, label}, ...], distCode? }        → bulk add
 *  - { fpsId, label, pollEnabled?, reportTimes? }        → single upsert (edit)
 */
export async function POST(req: Request) {
  const body = await readJson(req);

  if (body && typeof body === "object" && "shops" in body) {
    const parsed = bulkAddInput.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    try {
      const saved = await prisma.$transaction(
        parsed.data.shops.map((shop) =>
          prisma.monitorConfig.upsert({
            where: { fpsId: shop.fpsId },
            create: {
              fpsId: shop.fpsId,
              label: shop.label,
              distCode: parsed.data.distCode,
            },
            update: { label: shop.label },
          }),
        ),
      );
      return ok({ added: saved.length });
    } catch (err) {
      return failFromError(err, 500);
    }
  }

  const parsed = monitorConfigInput.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const d = parsed.data;
  try {
    const saved = await prisma.monitorConfig.upsert({
      where: { fpsId: d.fpsId },
      create: d,
      update: {
        label: d.label,
        distCode: d.distCode,
        pollEnabled: d.pollEnabled,
        reportTimes: d.reportTimes,
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
    return fail("fpsId is required", 400);
  }
  try {
    await prisma.monitorConfig.delete({ where: { fpsId } });
    await prisma.dailyMonitorState.deleteMany({ where: { fpsId } });
    await prisma.dailyReportState.deleteMany({ where: { scope: fpsId } });
    return ok({ deleted: fpsId });
  } catch (err) {
    return failFromError(err, 500);
  }
}
