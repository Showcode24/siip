import type { ApplicationStatus } from "@/generated/prisma/enums";
import { db, type DbOrTx } from "@/server/db";
import { errors } from "@/server/lib/errors";

/** Statuses from which a graduate can access their cohort's training content. */
export const TRAINING_ACCESS: ApplicationStatus[] = [
  "IN_TRAINING",
  "FINAL_ASSESSMENT",
  "QUALIFIED",
  "MATCHED",
  "PLACED",
  "COMPLETED",
];

/** The graduate's current application (latest one that is not rejected or withdrawn). */
export function findCurrentApplication(graduateId: string, client: DbOrTx = db) {
  return client.application.findFirst({
    where: { graduateId, status: { notIn: ["REJECTED", "WITHDRAWN"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, cohortId: true },
  });
}

/** The current application, provided it gives access to training. */
export async function requireTrainingAccess(graduateId: string, client: DbOrTx = db) {
  const app = await findCurrentApplication(graduateId, client);
  // Training is retired: only interns from the old cohorts can still open it.
  if (!app || !app.cohortId || !TRAINING_ACCESS.includes(app.status)) {
    throw errors.forbidden("Training is no longer part of SIIP");
  }
  return { ...app, cohortId: app.cohortId };
}
