import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { changeMyOpeningStatus } from "@/server/services/opening.service";
import { idParam } from "@/server/validators/common";
import { openingStatusSchema } from "@/server/validators/company";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  const { id } = parseWith(idParam, await params);
  return ok(await changeMyOpeningStatus(ctx, id, (await parseJson(req, openingStatusSchema)).status));
});
