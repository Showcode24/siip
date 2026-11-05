import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { created, handle, parseJson, parseWith } from "@/server/lib/http";
import { grantRetake } from "@/server/services/assessment.service";
import { retakeSchema } from "@/server/validators/assessment";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return created(await grantRetake(actor, id, await parseJson(req, retakeSchema)));
});
