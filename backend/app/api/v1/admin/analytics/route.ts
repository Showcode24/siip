import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { getAnalytics } from "@/server/services/analytics.service";
import { analyticsQuery } from "@/server/validators/admin";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const { cohortId } = parseQuery(req, analyticsQuery);
  return ok(await getAnalytics(cohortId));
});
