import { requireGraduate } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { getMyTraining } from "@/server/services/training.service";

export const GET = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return ok(await getMyTraining(graduateId));
});
