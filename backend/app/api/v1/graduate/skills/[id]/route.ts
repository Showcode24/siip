import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { removeSkill, updateSkill } from "@/server/services/skill.service";
import { idParam } from "@/server/validators/common";
import { updateSkillSchema } from "@/server/validators/graduate";

/** Change the claimed level or certificate details (a checked skill goes back to pending). */
export const PATCH = handle<{ id: string }>(async (req, { params }) => {
  const { graduateId } = await requireGraduate(req);
  const { id } = parseWith(idParam, await params);
  return ok(await updateSkill(graduateId, id, await parseJson(req, updateSkillSchema)));
});

export const DELETE = handle<{ id: string }>(async (req, { params }) => {
  const { graduateId } = await requireGraduate(req);
  const { id } = parseWith(idParam, await params);
  return ok(await removeSkill(graduateId, id));
});
