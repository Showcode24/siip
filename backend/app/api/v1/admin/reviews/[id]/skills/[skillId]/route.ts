import { z } from "zod";
import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { decideSkill } from "@/server/services/profile-review.service";
import { skillDecisionSchema } from "@/server/validators/review";

const params = z.object({ id: z.string().min(1).max(64), skillId: z.string().min(1).max(64) });

/** Verify a skill at the claimed level or a lower one, or reject it with a reason. */
export const POST = handle<{ id: string; skillId: string }>(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { id, skillId } = parseWith(params, await ctx.params);
  return ok(await decideSkill(toAuditActor(admin), id, skillId, await parseJson(req, skillDecisionSchema)));
});
