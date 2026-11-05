import { requireGraduate } from "@/server/auth/session";
import { created, handle, ok, parseJson } from "@/server/lib/http";
import { listMyCheckIns, submitInternCheckIn } from "@/server/services/internship.service";
import { checkInSchema } from "@/server/validators/internship";

export const GET = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return ok(await listMyCheckIns(graduateId));
});

export const POST = handle(async (req) => {
  const { user, graduateId } = await requireGraduate(req);
  return created(await submitInternCheckIn(user.id, graduateId, await parseJson(req, checkInSchema)));
});
