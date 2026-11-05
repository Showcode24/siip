import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { withdrawMatch } from "@/server/services/match.service";
import { idParam } from "@/server/validators/common";
import { withdrawMatchSchema } from "@/server/validators/matching";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  const body = await parseJson(req, withdrawMatchSchema);
  return ok(await withdrawMatch(actor, id, body.reason));
});
