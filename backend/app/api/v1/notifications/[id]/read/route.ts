import { requireUser } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { markNotificationRead } from "@/server/services/notification.service";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = parseWith(idParam, await params);
  await markNotificationRead(user.id, id);
  return ok({ id, read: true });
});
