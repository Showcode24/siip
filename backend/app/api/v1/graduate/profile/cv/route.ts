import { requireGraduate } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { getCvDownloadUrl } from "@/server/services/graduate.service";

export const GET = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return ok(await getCvDownloadUrl(graduateId));
});
