import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { getSkillDocumentUrlForAdmin } from "@/server/services/skill.service";
import { idParam } from "@/server/validators/common";

/** Admins open any intern's document; each view is written to the audit log. */
export const GET = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getSkillDocumentUrlForAdmin(toAuditActor(admin), id));
});
