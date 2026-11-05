import { requireGraduate } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { getMyPlacement } from "@/server/services/placement.service";

export const GET = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return ok(await getMyPlacement(graduateId));
});
