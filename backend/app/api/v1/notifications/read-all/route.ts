import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { markAllNotificationsRead } from "@/server/services/notification.service";

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  return ok(await markAllNotificationsRead(user.id));
});
