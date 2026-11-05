import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseJson } from "@/server/lib/http";
import { signGraduateUpload } from "@/server/services/graduate.service";
import { signUploadSchema } from "@/server/validators/graduate";
import { enforceRateLimit } from "@/server/lib/rate-limit";

// Step 1 of an upload: signed fields for a direct browser-to-Cloudinary POST.
export const POST = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  await enforceRateLimit("upload", graduateId);
  const { kind, extension } = await parseJson(req, signUploadSchema);
  return ok(signGraduateUpload(graduateId, kind, extension));
});
