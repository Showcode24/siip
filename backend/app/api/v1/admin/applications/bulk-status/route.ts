import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson } from "@/server/lib/http";
import { bulkChangeApplicationStatus } from "@/server/services/application.service";
import { bulkChangeStatusSchema } from "@/server/validators/application";

export const POST = handle(async (req) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, bulkChangeStatusSchema);
  return ok(await bulkChangeApplicationStatus(toAuditActor(admin), input));
});
