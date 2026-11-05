import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { saveAnswers } from "@/server/services/attempt.service";
import { saveAnswersSchema } from "@/server/validators/assessment";
import { idParam } from "@/server/validators/common";
import { enforceRateLimit } from "@/server/lib/rate-limit";

export const PUT = handle<{ id: string }>(async (req, { params }) => {
  const { graduateId } = await requireGraduate(req);
  await enforceRateLimit("examSave", graduateId);
  const { id } = parseWith(idParam, await params);
  return ok(await saveAnswers(graduateId, id, (await parseJson(req, saveAnswersSchema)).answers));
});
