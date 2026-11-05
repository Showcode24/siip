import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseJson } from "@/server/lib/http";
import { setSkills } from "@/server/services/graduate.service";
import { setSkillsSchema } from "@/server/validators/graduate";

export const PUT = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  const input = await parseJson(req, setSkillsSchema);
  return ok(await setSkills(graduateId, input));
});
