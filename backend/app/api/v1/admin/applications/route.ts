import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { listApplicationsForAdmin } from "@/server/services/application.service";
import { adminApplicationListQuery } from "@/server/validators/application";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const query = parseQuery(req, adminApplicationListQuery);
  const page = await listApplicationsForAdmin(query);
  return ok(page.items, pageMeta(page));
});
