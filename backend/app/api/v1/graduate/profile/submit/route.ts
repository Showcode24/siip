import { requireGraduate, toAuditActor } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { submitForReview } from "@/server/services/skill.service";

/** Send the profile to SIIP for review. Every skill needs at least one document. */
export const POST = handle(async (req) => {
  const { user, graduateId } = await requireGraduate(req);
  return ok(await submitForReview(toAuditActor(user), graduateId));
});
