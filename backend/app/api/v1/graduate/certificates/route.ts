import { requireGraduate } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { listMyCertificates } from "@/server/services/certificate.service";

export const GET = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return ok(await listMyCertificates(graduateId));
});
