import { z } from "zod";

/**
 * Server-side environment. Har field ka default hai taaki build kabhi na toote —
 * missing config request-time pe loudly fail hoti hai (dekho `requireEnv`).
 *
 * Next 16: ye values dynamic (request-time) code me hi padho — top-level module
 * scope me nahi — taaki Railway ke runtime env vars build me bake na hon.
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
  /** "1" → email actually bhejo mat, bas log karo (local monitor testing ke liye). */
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
