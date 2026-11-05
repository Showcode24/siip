import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { deleteQuestion, replaceQuestion } from "@/server/services/assessment.service";
import { questionSchema } from "@/server/validators/assessment";
import { idParam } from "@/server/validators/common";

export const PUT = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await replaceQuestion(actor, id, await parseJson(req, questionSchema)));
});

export const DELETE = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await deleteQuestion(actor, id).then(() => ({ id, deleted: true })));
});
