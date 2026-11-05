import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { getMyAttempt } from "@/server/services/attempt.service";
import { idParam } from "@/server/validators/common";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  const { graduateId } = await requireGraduate(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getMyAttempt(graduateId, id));
});
