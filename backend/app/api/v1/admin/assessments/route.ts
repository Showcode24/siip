import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { created, handle, ok, parseJson, parseQuery } from "@/server/lib/http";
import { createAssessment, listAssessments } from "@/server/services/assessment.service";
import { assessmentListQuery, createAssessmentSchema } from "@/server/validators/assessment";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  return ok(await listAssessments(parseQuery(req, assessmentListQuery)));
});

export const POST = handle(async (req) => {
  const actor = toAuditActor(await requireAdmin(req));
  return created(await createAssessment(actor, await parseJson(req, createAssessmentSchema)));
});
