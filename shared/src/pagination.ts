import { z } from "zod";

/** Cursor pagination query used by every list endpoint. */
export const paginationQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
