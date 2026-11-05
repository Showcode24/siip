import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { created, handle, parseJson, parseWith } from "@/server/lib/http";
import { createLesson } from "@/server/services/training.service";
import { lessonSchema } from "@/server/validators/training";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return created(await createLesson(actor, id, await parseJson(req, lessonSchema)));
});
