import { z } from "zod";

/** Govt FPS id — 10–14 digits (Rohtak me 12). */
export const fpsId = z
  .string({ error: "fpsId chahiye" })
  .trim()
  .regex(/^\d{10,14}$/, "fpsId 10–14 digit ka hona chahiye");

const monthYear = {
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2035),
};

/** API 2 / 4 ka body: { fpsId, month, year } */
export const fpsMonthYear = z.object({ fpsId, ...monthYear });

/** API 3 ka body: dist_code bhi chahiye (default env se) */
export const fpsMonthYearDist = z.object({
  fpsId,
  distCode: z
    .string()
    .trim()
    .regex(/^\d{2,4}$/)
    .optional(),
  ...monthYear,
});

/** Abhi ka IST month/year — jab body me na aaye. */
export function currentMonthYear(): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { month: get("month"), year: get("year") };
}

/** Body JSON safely parse karo — khali/invalid pe {} */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
