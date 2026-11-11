import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import { signSkillDocument } from "@/server/services/skill.service";
import { idParam } from "@/server/validators/common";

// Step 1 of a file upload: signed fields for a direct browser-to-Cloudinary POST.
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const { graduateId } = await requireGraduate(req);
  await enforceRateLimit("upload", graduateId);
  const { id } = parseWith(idParam, await params);
  return ok(await signSkillDocument(graduateId, id));
});
