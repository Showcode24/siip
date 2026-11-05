import { requireGraduate } from "@/server/auth/session";
import { created, handle, ok, parseJson } from "@/server/lib/http";
import { applyToCohort, listMyApplications } from "@/server/services/application.service";
import { applySchema } from "@/server/validators/application";

export const GET = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return ok(await listMyApplications(graduateId));
});

export const POST = handle(async (req) => {
  const { user, graduateId } = await requireGraduate(req);
  const input = await parseJson(req, applySchema);
  return created(await applyToCohort(user, graduateId, input));
});
