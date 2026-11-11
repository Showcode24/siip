import { requireGraduate } from "@/server/auth/session";
import { created, handle, ok, parseJson } from "@/server/lib/http";
import { addSkill, listMySkills } from "@/server/services/skill.service";
import { addSkillSchema } from "@/server/validators/graduate";

export const GET = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return ok(await listMySkills(graduateId));
});

/** Add a skill (from the list, or "Other" with its own name) at a claimed level. */
export const POST = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return created(await addSkill(graduateId, await parseJson(req, addSkillSchema)));
});
