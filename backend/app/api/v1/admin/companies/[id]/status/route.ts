import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { changeCompanyStatus } from "@/server/services/company.service";
import { idParam } from "@/server/validators/common";
import { companyStatusSchema } from "@/server/validators/company";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  const body = await parseJson(req, companyStatusSchema);
  return ok(await changeCompanyStatus(actor, id, body.status, body.reason));
});
