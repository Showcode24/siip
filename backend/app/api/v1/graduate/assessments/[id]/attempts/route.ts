import { requireGraduate } from "@/server/auth/session";
import { created, handle, parseWith } from "@/server/lib/http";
import { startAttempt } from "@/server/services/attempt.service";
import { idParam } from "@/server/validators/common";
import { enforceRateLimit } from "@/server/lib/rate-limit";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const { graduateId } = await requireGraduate(req);
  await enforceRateLimit("examStart", graduateId);
  const { id } = parseWith(idParam, await params);
  return created(await startAttempt(graduateId, id));
});
