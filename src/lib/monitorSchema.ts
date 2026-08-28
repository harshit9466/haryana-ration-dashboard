import { z } from "zod";

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be "HH:mm"');

const hhmmOrNull = z
  .union([hhmm, z.literal(""), z.null()])
  .transform((v) => (v === "" || v == null ? null : v));

/** Global monitor settings (admin "Settings" card). */
export const settingsInput = z.object({
  notifyEmails: z
    .array(z.string().trim().email("enter a valid email"))
    .max(5)
    .default([]),
  pollFrom: hhmm.default("05:00"),
  openedDigestTime: hhmm.default("13:00"),
  eodDigestTime: hhmm.default("21:00"),
});
export type SettingsInput = z.infer<typeof settingsInput>;

/** One monitored shop. Used for both single edit and bulk add. */
export const monitorConfigInput = z.object({
  fpsId: z
    .string()
    .trim()
    .regex(/^\d{10,14}$/, "fpsId must be 10–14 digits"),
  label: z.string().trim().max(120).default(""),
  distCode: z
    .string()
    .trim()
    .regex(/^\d{2,4}$/)
    .default("073"),
  pollEnabled: z.boolean().default(true),
  openedOverride: hhmmOrNull.default(null),
  eodOverride: hhmmOrNull.default(null),
});
export type MonitorConfigInput = z.infer<typeof monitorConfigInput>;

/** Bulk add: many shops with shared settings. */
export const bulkAddInput = z.object({
  shops: z
    .array(
      z.object({
        fpsId: z
          .string()
          .trim()
          .regex(/^\d{10,14}$/, "fpsId must be 10–14 digits"),
        label: z.string().trim().max(120).default(""),
      }),
    )
    .min(1, "pick at least one shop")
    .max(50),
  distCode: z
    .string()
    .trim()
    .regex(/^\d{2,4}$/)
    .default("073"),
});
export type BulkAddInput = z.infer<typeof bulkAddInput>;
