import { z } from "zod";
import { paginationQuery } from "../pagination";
import { booleanParam } from "./common";

export const notificationListQuery = paginationQuery.extend({
  unread: booleanParam.optional(),
});
export type NotificationListQuery = z.infer<typeof notificationListQuery>;
