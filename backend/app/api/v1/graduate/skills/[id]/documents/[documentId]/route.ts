import { z } from "zod";
import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { removeSkillDocument } from "@/server/services/skill.service";

const params = z.object({ id: z.string().min(1).max(64), documentId: z.string().min(1).max(64) });

export const DELETE = handle<{ id: string; documentId: string }>(async (req, ctx) => {
  const { graduateId } = await requireGraduate(req);
  const { id, documentId } = parseWith(params, await ctx.params);
  return ok(await removeSkillDocument(graduateId, id, documentId));
});
