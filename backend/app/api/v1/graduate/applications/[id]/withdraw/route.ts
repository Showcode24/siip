import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { withdrawApplication } from "@/server/services/application.service";
import { withdrawSchema } from "@/server/validators/application";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const { user, graduateId } = await requireGraduate(req);
  const { id } = parseWith(idParam, await params);
  const { reason } = await parseJson(req, withdrawSchema);
  return ok(await withdrawApplication(user, graduateId, id, reason));
});
