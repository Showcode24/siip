import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { getCvDownloadUrlForAdmin } from "@/server/services/graduate.service";
import { idParam } from "@/server/validators/common";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getCvDownloadUrlForAdmin(toAuditActor(admin), id));
});
