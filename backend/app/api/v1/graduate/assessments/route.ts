import { requireGraduate } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { listMyAssessments } from "@/server/services/attempt.service";

export const GET = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return ok(await listMyAssessments(graduateId));
});
