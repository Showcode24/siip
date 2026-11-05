import type { Prisma } from "@/generated/prisma/client";
import { db, type DbOrTx } from "@/server/db";
import { errors } from "@/server/lib/errors";
import { cursorArgs, toPage } from "@/server/lib/pagination";
import type { NotificationListQuery } from "@/server/validators/notification";

export interface NewNotification {
  userId: string;
  /** Dotted event name the client can switch on, e.g. "application.status_changed". */
  type: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
}

/** Pass the transaction client so the notification commits with the change it describes. */
export async function createNotification(client: DbOrTx, n: NewNotification) {
  await client.notification.create({ data: n });
}

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
} as const;

export async function listNotifications(userId: string, query: NotificationListQuery) {
  const where: Prisma.NotificationWhereInput = { userId, ...(query.unread ? { readAt: null } : {}) };
  const [rows, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorArgs(query),
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { page: toPage(rows, query.limit), unreadCount };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  // Scoped by userId: marking someone else's notification looks like "not found".
  const { count } = await db.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
  if (count === 0) throw errors.notFound("Notification");
}

export async function markAllNotificationsRead(userId: string) {
  const { count } = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: count };
}
