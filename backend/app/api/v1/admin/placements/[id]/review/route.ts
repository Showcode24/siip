import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { reviewPlacement } from "@/server/services/certificate.service";
import { idParam } from "@/server/validators/common";
import { programmeEvaluationSchema } from "@/server/validators/internship";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await reviewPlacement(actor, id, await parseJson(req, programmeEvaluationSchema)));
});
