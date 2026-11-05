import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { removeMember } from "@/server/services/company.service";
import { idParam } from "@/server/validators/common";

export const DELETE = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  const { id } = parseWith(idParam, await params);
  return ok(await removeMember(ctx, id));
});
