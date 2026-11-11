import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { getSkillDocumentUrl } from "@/server/services/skill.service";
import { idParam } from "@/server/validators/common";

/** A short-lived link to one of the intern's own documents. */
export const GET = handle<{ id: string }>(async (req, { params }) => {
  const { graduateId } = await requireGraduate(req);
  const { id } = parseWith(idParam, await params);
  const { url, kind, expiresIn } = await getSkillDocumentUrl(graduateId, id);
  return ok({ url, kind, expiresIn });
});
