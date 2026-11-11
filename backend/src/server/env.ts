import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),

  APP_URL: z.url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32),

  // When unset, emails are logged (not sent). Required in production.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("SIIP <no-reply@siip.ng>"),
  // Where interns can write to (e.g. to appeal a removed profile). Optional.
  SUPPORT_EMAIL: z.email().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  CRON_SECRET: z.string().min(16).optional(),

  // Bump when the privacy notice changes; stored with each user's consent.
  CONSENT_VERSION: z.string().default("2026-11-01"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Parsed lazily so unit tests that never touch config don't need every variable. */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    const missing = (
      [
        "RESEND_API_KEY",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
        "CRON_SECRET",
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
      ] as const
    ).filter((key) => !parsed.data[key]);
    if (missing.length > 0) {
      throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
    }
  }
  cached = parsed.data;
  return cached;
}
