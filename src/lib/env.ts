import { z } from "zod";

/**
 * Server-side environment. Every field has a default so the build never breaks —
 * missing config fails loudly at request time instead (see `requireEnv`).
 *
 * Next 16: read these values only in dynamic (request-time) code, not at module
 * top level, so Railway's runtime env vars aren't baked into the build.
 */
const schema = z.object({
  EPOS_BASE_URL: z.string().url().default("https://epos.haryanafood.gov.in"),
  DEFAULT_DIST_CODE: z.string().min(1).default("073"),
  DEFAULT_AFSO_CODE: z.string().min(1).default("15019"),
  DEFAULT_SRC_NO: z.string().default(""),

  ADMIN_PASSWORD: z.string().default(""),
  CRON_SECRET: z.string().default(""),

  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("onboarding@resend.dev"),
  NOTIFY_EMAIL: z.string().default(""),
  /** "1" → don't actually send email, just log it (for local monitor testing). */
  MAILER_DEV_NOOP: z.string().default(""),

  DATABASE_URL: z.string().default(""),

  TZ: z.string().default("Asia/Kolkata"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    cached = schema.parse(process.env);
  }
  return cached;
}

/** Ek required env value do; missing ho to saaf error (500 ban jaayega). */
export function requireEnv<K extends keyof Env>(key: K): Env[K] {
  const value = env()[key];
  if (value === "" || value == null) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
