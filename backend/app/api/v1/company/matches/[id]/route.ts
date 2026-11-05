import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { getCompanyMatch } from "@/server/services/match.service";
import { idParam } from "@/server/validators/common";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getCompanyMatch(ctx, id));
});
