import { z } from "zod";

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, '"HH:mm" format chahiye');

export const monitorConfigInput = z.object({
  fpsId: z
    .string()
    .trim()
    .regex(/^\d{10,14}$/, "fpsId 10–14 digit ka hona chahiye"),
  label: z.string().trim().max(120).default(""),
  distCode: z
    .string()
    .trim()
    .regex(/^\d{2,4}$/)
    .default("073"),
  emails: z
    .array(z.string().trim().email("Valid email daalo"))
    .min(1, "Kam se kam ek email chahiye")
    .max(5),
  shopOpen: hhmm.default("05:00"),
  shopClose: hhmm.default("14:00"),
  eodTime: hhmm.default("21:00"),
  pollEnabled: z.boolean().default(true),
});

export type MonitorConfigInput = z.infer<typeof monitorConfigInput>;
