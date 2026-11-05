import { requireCompanyMember } from "@/server/auth/session";
import { created, handle, parseJson, parseWith } from "@/server/lib/http";
import { acceptMatch } from "@/server/services/match.service";
import { idParam } from "@/server/validators/common";
import { acceptMatchSchema } from "@/server/validators/matching";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  const { id } = parseWith(idParam, await params);
  return created(await acceptMatch(ctx, id, await parseJson(req, acceptMatchSchema)));
});
