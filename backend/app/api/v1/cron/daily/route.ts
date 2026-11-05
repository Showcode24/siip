import { requireCronSecret } from "@/server/auth/cron";
import { handle, ok } from "@/server/lib/http";
import { runDailyJobs } from "@/server/services/cron.service";

// Triggered by Vercel Cron (see vercel.json). Reminders, auto-closing cohorts,
// expiring overdue exam attempts and NDPA anonymisation.
export const maxDuration = 60;

export const GET = handle(async (req) => {
  requireCronSecret(req);
  return ok(await runDailyJobs());
});
