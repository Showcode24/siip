import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { terminatePlacement } from "@/server/services/placement.service";
import { idParam } from "@/server/validators/common";
import { endPlacementSchema } from "@/server/validators/matching";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  const body = await parseJson(req, endPlacementSchema);
  return ok(await terminatePlacement(actor, id, body.reason));
});
