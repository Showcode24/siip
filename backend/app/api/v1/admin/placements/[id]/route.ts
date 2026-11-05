import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { getPlacementForAdmin } from "@/server/services/placement.service";
import { idParam } from "@/server/validators/common";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getPlacementForAdmin(id));
});
