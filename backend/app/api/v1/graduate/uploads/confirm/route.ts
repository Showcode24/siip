import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseJson } from "@/server/lib/http";
import { confirmGraduateUpload } from "@/server/services/graduate.service";
import { confirmUploadSchema } from "@/server/validators/graduate";
import { enforceRateLimit } from "@/server/lib/rate-limit";

// Step 2 of an upload: verifies the file on Cloudinary and attaches it to the profile.
export const POST = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  await enforceRateLimit("upload", graduateId);
  const { kind, publicId } = await parseJson(req, confirmUploadSchema);
  return ok(await confirmGraduateUpload(graduateId, kind, publicId));
});
