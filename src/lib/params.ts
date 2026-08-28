import { z } from "zod";

/** Government FPS id — 10–14 digits (12 in Rohtak). */
export const fpsId = z
  .string({ error: "fpsId is required" })
  .trim()
  .regex(/^\d{10,14}$/, "fpsId must be 10–14 digits");

const monthYear = {
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2035),
};

/** Body for API 2 / 4: { fpsId, month, year } */
export const fpsMonthYear = z.object({ fpsId, ...monthYear });

/** Body for API 3: also needs dist_code (defaults from env) */
export const fpsMonthYearDist = z.object({
  fpsId,
  distCode: z
    .string()
    .trim()
    .regex(/^\d{2,4}$/)
    .optional(),
  ...monthYear,
});

/** Current IST month/year — used when the request body omits them. */
export function currentMonthYear(): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { month: get("month"), year: get("year") };
}

/** Parse the request JSON body safely — returns {} on empty/invalid. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
