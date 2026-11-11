import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { decideProfile } from "@/server/services/profile-review.service";
import { idParam } from "@/server/validators/common";
import { profileDecisionSchema } from "@/server/validators/review";

/** Approve, ask for more documents, remove (with a reason), or reopen a removed profile. */
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await decideProfile(toAuditActor(admin), id, await parseJson(req, profileDecisionSchema)));
});
