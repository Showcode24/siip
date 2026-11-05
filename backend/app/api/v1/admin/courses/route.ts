import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { created, handle, ok, parseJson, parseQuery } from "@/server/lib/http";
import { createCourse, listCourses } from "@/server/services/training.service";
import { courseListQuery, createCourseSchema } from "@/server/validators/training";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  return ok(await listCourses(parseQuery(req, courseListQuery).cohortId));
});

export const POST = handle(async (req) => {
  const actor = toAuditActor(await requireAdmin(req));
  return created(await createCourse(actor, await parseJson(req, createCourseSchema)));
});
