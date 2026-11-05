import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { getCohortForAdmin, updateCohort } from "@/server/services/cohort.service";
import { updateCohortSchema } from "@/server/validators/cohort";
import { idParam } from "@/server/validators/common";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getCohortForAdmin(id));
});

export const PATCH = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  const input = await parseJson(req, updateCohortSchema);
  return ok(await updateCohort(toAuditActor(admin), id, input));
});
