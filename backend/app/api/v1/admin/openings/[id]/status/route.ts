import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { changeOpeningStatusAsAdmin } from "@/server/services/opening.service";
import { idParam } from "@/server/validators/common";
import { openingStatusSchema } from "@/server/validators/company";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return ok(await changeOpeningStatusAsAdmin(actor, id, (await parseJson(req, openingStatusSchema)).status));
});
