import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { deleteLesson, updateLesson } from "@/server/services/training.service";
import { updateLessonSchema } from "@/server/validators/training";
import { idParam } from "@/server/validators/common";

export const PATCH = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await updateLesson(actor, id, await parseJson(req, updateLessonSchema)));
});

export const DELETE = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await deleteLesson(actor, id));
});
