import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { changeApplicationStatus } from "@/server/services/application.service";
import { changeStatusSchema } from "@/server/validators/application";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  const input = await parseJson(req, changeStatusSchema);
  return ok(await changeApplicationStatus(toAuditActor(admin), id, input));
});
