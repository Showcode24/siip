import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { cursorArgs, paginationQuery, toPage } from "@/server/lib/pagination";

export const auditListQuery = paginationQuery.extend({
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
});

/** Newest first. Each entry names who did it (when the actor still exists). */
export async function listAuditLog(query: z.infer<typeof auditListQuery>) {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
  };
  const rows = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      actorId: true,
      actorRole: true,
      action: true,
      entityType: true,
      entityId: true,
      before: true,
      after: true,
      metadata: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
    ...cursorArgs(query),
  });
  const page = toPage(rows, query.limit);
  return {
    ...page,
    items: page.items.map(({ actor, ...e }) => ({ ...e, actorName: actor?.name ?? null })),
  };
}
