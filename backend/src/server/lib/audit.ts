import type { DbOrTx } from "@/server/db";
import type { Prisma, UserRole } from "@/generated/prisma/client";

export interface AuditActor {
  userId: string;
  role: UserRole;
}

export interface AuditEntry {
  /** null for system actions (cron jobs, automatic transitions). */
  actor: AuditActor | null;
  /** Dotted verb, e.g. "application.status_changed", "company.verified". */
  action: string;
  entityType: string;
  entityId: string;
  /** Only the fields that changed. Never pass PII here (NDPA). */
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

/** Write an audit row. Pass the transaction client so it commits with the change. */
export async function recordAudit(client: DbOrTx, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actor?.userId ?? null,
      actorRole: entry.actor?.role ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before,
      after: entry.after,
      metadata: entry.metadata,
    },
  });
}
