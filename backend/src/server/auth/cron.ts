import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { errors } from "@/server/lib/errors";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Compared in constant time. */
export function requireCronSecret(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) throw errors.forbidden("Cron is not configured");
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!timingSafeEqual(digest(given), digest(secret))) throw errors.unauthenticated("Invalid cron secret");
}
