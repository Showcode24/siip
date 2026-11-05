import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { getApplicationForAdmin } from "@/server/services/application.service";
import { idParam } from "@/server/validators/common";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getApplicationForAdmin(id));
});
