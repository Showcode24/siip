import type { z } from "zod";
import { paginationQuery } from "@siip/shared/pagination";

export { paginationQuery };

export type PaginationQuery = z.infer<typeof paginationQuery>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Prisma args for cursor pagination. Fetches one extra row to know whether
 * another page exists. Pair with a stable orderBy that ends in `id`.
 */
export function cursorArgs({ cursor, limit }: PaginationQuery) {
  return {
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  };
}

export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export function pageMeta<T>(page: Page<T>) {
  return { nextCursor: page.nextCursor, count: page.items.length };
}
