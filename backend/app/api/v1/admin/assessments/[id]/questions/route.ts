import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { created, handle, parseJson, parseWith } from "@/server/lib/http";
import { addQuestion } from "@/server/services/assessment.service";
import { questionSchema } from "@/server/validators/assessment";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return created(await addQuestion(actor, id, await parseJson(req, questionSchema)));
});
