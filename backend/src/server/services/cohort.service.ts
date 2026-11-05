import { randomBytes } from "node:crypto";
import type { CohortStatus } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import { cohortMachine } from "@/server/lib/state-machine";
import {
  cohortDateProblem,
  type CreateCohortInput,
  type UpdateCohortInput,
} from "@/server/validators/cohort";

const publicCohortSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  applicationOpensAt: true,
  applicationClosesAt: true,
  trainingStartsAt: true,
  trainingEndsAt: true,
  internshipStartsAt: true,
  internshipEndsAt: true,
} as const;

/** Cohorts a graduate can apply to right now. */
export async function listOpenCohorts(now = new Date()) {
  return db.cohort.findMany({
    where: {
      status: "APPLICATIONS_OPEN",
      applicationOpensAt: { lte: now },
      applicationClosesAt: { gt: now },
    },
    select: publicCohortSelect,
    orderBy: { applicationClosesAt: "asc" },
  });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

function slugFor(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return `${base}-${randomBytes(3).toString("hex")}`;
}

function assertDates(dates: Parameters<typeof cohortDateProblem>[0]) {
  const problem = cohortDateProblem(dates);
  if (problem) throw errors.badRequest(problem);
}

export async function listCohortsForAdmin() {
  return db.cohort.findMany({
    select: {
      ...publicCohortSelect,
      capacity: true,
      status: true,
      createdAt: true,
      _count: { select: { applications: true } },
    },
    orderBy: [{ applicationOpensAt: "desc" }, { id: "desc" }],
  });
}

export async function getCohortForAdmin(cohortId: string) {
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: { ...publicCohortSelect, capacity: true, status: true, createdAt: true, updatedAt: true },
  });
  if (!cohort) throw errors.notFound("Cohort");
  const byStatus = await db.application.groupBy({
    by: ["status"],
    where: { cohortId },
    _count: { _all: true },
  });
  return {
    ...cohort,
    applicationCounts: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
  };
}

export async function createCohort(actor: AuditActor, input: CreateCohortInput) {
  assertDates(input);
  return db.$transaction(async (tx) => {
    const cohort = await tx.cohort.create({
      data: { ...input, description: input.description ?? null, slug: slugFor(input.name) },
    });
    await recordAudit(tx, {
      actor,
      action: "cohort.created",
      entityType: "Cohort",
      entityId: cohort.id,
      after: { name: cohort.name, capacity: cohort.capacity, status: cohort.status },
    });
    return cohort;
  });
}

export async function updateCohort(actor: AuditActor, cohortId: string, input: UpdateCohortInput) {
  return db.$transaction(async (tx) => {
    const current = await tx.cohort.findUnique({ where: { id: cohortId } });
    if (!current) throw errors.notFound("Cohort");
    if (current.status === "ARCHIVED") throw errors.conflict("Archived cohorts cannot be edited");
    assertDates({ ...current, ...input });

    const updated = await tx.cohort.update({ where: { id: cohortId }, data: input });
    const changed = Object.keys(input) as Array<keyof UpdateCohortInput>;
    await recordAudit(tx, {
      actor,
      action: "cohort.updated",
      entityType: "Cohort",
      entityId: cohortId,
      before: JSON.parse(JSON.stringify(Object.fromEntries(changed.map((k) => [k, current[k]])))),
      after: JSON.parse(JSON.stringify(Object.fromEntries(changed.map((k) => [k, updated[k]])))),
    });
    return updated;
  });
}

/** Moves a cohort through its lifecycle (e.g. open or close applications). */
export async function changeCohortStatus(
  actor: AuditActor | null,
  cohortId: string,
  to: CohortStatus,
  now = new Date(),
) {
  return db.$transaction(async (tx) => {
    const current = await tx.cohort.findUnique({ where: { id: cohortId } });
    if (!current) throw errors.notFound("Cohort");
    cohortMachine.assert(current.status, to, actor ? "ADMIN" : "SYSTEM");
    if (to === "APPLICATIONS_OPEN" && current.applicationClosesAt <= now) {
      throw errors.badRequest("The application window has ended. Move the closing date first.");
    }

    const { count } = await tx.cohort.updateMany({
      where: { id: cohortId, status: current.status },
      data: { status: to },
    });
    if (count === 0) throw errors.conflict("This cohort was changed by someone else. Refresh and try again.");

    await recordAudit(tx, {
      actor,
      action: "cohort.status_changed",
      entityType: "Cohort",
      entityId: cohortId,
      before: { status: current.status },
      after: { status: to },
    });
    return { ...current, status: to };
  });
}
