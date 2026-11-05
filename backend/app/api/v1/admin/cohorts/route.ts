import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { created, handle, ok, parseJson } from "@/server/lib/http";
import { createCohort, listCohortsForAdmin } from "@/server/services/cohort.service";
import { createCohortSchema } from "@/server/validators/cohort";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  return ok(await listCohortsForAdmin());
});

export const POST = handle(async (req) => {
  const admin = await requireAdmin(req);
  const input = await parseJson(req, createCohortSchema);
  return created(await createCohort(toAuditActor(admin), input));
});
