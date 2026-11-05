import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import {
  deleteAssessment,
  getAssessmentForAdmin,
  updateAssessment,
} from "@/server/services/assessment.service";
import { updateAssessmentSchema } from "@/server/validators/assessment";
import { idParam } from "@/server/validators/common";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getAssessmentForAdmin(id));
});

export const PATCH = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await updateAssessment(actor, id, await parseJson(req, updateAssessmentSchema)));
});

export const DELETE = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await deleteAssessment(actor, id).then(() => ({ id, deleted: true })));
});
