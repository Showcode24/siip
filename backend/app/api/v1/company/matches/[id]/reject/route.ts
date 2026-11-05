import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { rejectMatch } from "@/server/services/match.service";
import { idParam } from "@/server/validators/common";
import { rejectMatchSchema } from "@/server/validators/matching";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  const { id } = parseWith(idParam, await params);
  const body = await parseJson(req, rejectMatchSchema);
  return ok(await rejectMatch(ctx, id, body.reason));
});
