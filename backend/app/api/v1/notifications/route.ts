import { requireUser } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { listNotifications } from "@/server/services/notification.service";
import { notificationListQuery } from "@/server/validators/notification";

// Any signed-in user: graduates, company members and admins.
export const GET = handle(async (req) => {
  const user = await requireUser(req);
  const query = parseQuery(req, notificationListQuery);
  const { page, unreadCount } = await listNotifications(user.id, query);
  return ok(page.items, { ...pageMeta(page), unreadCount });
});
