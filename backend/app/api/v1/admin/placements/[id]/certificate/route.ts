import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { created, handle, parseWith } from "@/server/lib/http";
import { issueCertificate } from "@/server/services/certificate.service";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const actor = toAuditActor(await requireAdmin(req));
  const { id } = parseWith(idParam, await params);
  return created(await issueCertificate(actor, id));
});
