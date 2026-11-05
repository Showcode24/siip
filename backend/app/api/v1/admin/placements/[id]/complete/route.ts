import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { completePlacement } from "@/server/services/placement.service";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await completePlacement(actor, id));
});
