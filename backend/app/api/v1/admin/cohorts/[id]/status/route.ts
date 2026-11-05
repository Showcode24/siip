import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { changeCohortStatus } from "@/server/services/cohort.service";
import { cohortStatusSchema } from "@/server/validators/cohort";
import { idParam } from "@/server/validators/common";

// Open/close applications and move the cohort through its lifecycle.
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  const { status } = await parseJson(req, cohortStatusSchema);
  return ok(await changeCohortStatus(toAuditActor(admin), id, status));
});
