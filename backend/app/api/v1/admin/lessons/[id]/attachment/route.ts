import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { attachLessonFile } from "@/server/services/training.service";
import { lessonAttachmentSchema } from "@/server/validators/training";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await attachLessonFile(actor, id, (await parseJson(req, lessonAttachmentSchema)).publicId));
});
