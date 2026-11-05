import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { submitAttempt } from "@/server/services/attempt.service";
import { submitAttemptSchema } from "@/server/validators/assessment";
import { idParam } from "@/server/validators/common";
import { enforceRateLimit } from "@/server/lib/rate-limit";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const { graduateId } = await requireGraduate(req);
  await enforceRateLimit("examSubmit", graduateId);
  const { id } = parseWith(idParam, await params);
  return ok(await submitAttempt(graduateId, id, (await parseJson(req, submitAttemptSchema)).answers));
});
