import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { deleteCourse, getCourseForAdmin, updateCourse } from "@/server/services/training.service";
import { updateCourseSchema } from "@/server/validators/training";
import { idParam } from "@/server/validators/common";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getCourseForAdmin(id));
});

export const PATCH = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await updateCourse(actor, id, await parseJson(req, updateCourseSchema)));
});

export const DELETE = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await deleteCourse(actor, id));
});
