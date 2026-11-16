import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { auditListQuery, listAuditLog } from "@/server/services/audit.service";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const page = await listAuditLog(parseQuery(req, auditListQuery));
  return ok(page.items, pageMeta(page));
});
