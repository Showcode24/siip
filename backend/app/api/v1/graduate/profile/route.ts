import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseJson } from "@/server/lib/http";
import { getProfile, updateProfile } from "@/server/services/graduate.service";
import { updateProfileSchema } from "@/server/validators/graduate";

export const GET = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return ok(await getProfile(graduateId));
});

export const PATCH = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  const input = await parseJson(req, updateProfileSchema);
  return ok(await updateProfile(graduateId, input));
});
