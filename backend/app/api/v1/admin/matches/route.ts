import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { created, handle, parseJson } from "@/server/lib/http";
import { proposeMatch } from "@/server/services/match.service";
import { proposeMatchSchema } from "@/server/validators/matching";

export const POST = handle(async (req) => {
  const actor = toAuditActor(await requireAdmin(req));
  const body = await parseJson(req, proposeMatchSchema);
  return created(await proposeMatch(actor, body.openingId, body.applicationId));
});
