import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { db, type Tx } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { env } from "@/server/env";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import { toAppError } from "@/server/lib/http";
import { cursorArgs, toPage } from "@/server/lib/pagination";
import { missingForApplication } from "@/server/lib/profile-completeness";
import { applicationMachine, type Actor } from "@/server/lib/state-machine";
import type {
  AdminApplicationListQuery,
  ApplyInput,
  ChangeStatusInput,
} from "@/server/validators/application";
import { STATUS_EMAIL, statusNotification } from "./application-messages";
import { createNotification } from "./notification.service";

/** Statuses that hold one of the cohort's places (counted against capacity). */
const OCCUPIES_PLACE: ApplicationStatus[] = [
  "SHORTLISTED",
  "IN_TRAINING",
  "FINAL_ASSESSMENT",
  "QUALIFIED",
  "MATCHED",
  "PLACED",
  "COMPLETED",
];

/** A graduate may only be in one cohort at a time. */
const ACTIVE: ApplicationStatus[] = [
  "SUBMITTED",
  "SCREENING",
  ...OCCUPIES_PLACE.filter((s) => s !== "COMPLETED"),
];

/** What the caller needs, after commit, to send the status email. */
export interface ApplicationChange {
  applicationId: string;
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  reason: string | null;
  cohortName: string;
  recipient: { userId: string; email: string; firstName: string; deleted: boolean };
}

export interface TransitionInput {
  applicationId: string;
  to: ApplicationStatus;
  /** Who is asking, for the state machine. */
  actor: Actor;
  /** Who is asking, for the audit log. null = system. */
  auditActor: AuditActor | null;
  /** Shown to the graduate on their timeline. Required for REJECTED. */
  reason?: string;
  /** Internal screening note (admin only). */
  note?: string;
  /** When set, the application must belong to this graduate (else 404). */
  graduateId?: string;
}

/**
 * The single way an application changes status. Validates the move against the
 * state machine, then writes the status, a timeline event, an audit row and an
 * in-app notification in the caller's transaction. Send the email after commit
 * with `sendApplicationEmail`.
 */
export async function transitionApplication(tx: Tx, input: TransitionInput): Promise<ApplicationChange> {
  const app = await tx.application.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      status: true,
      cohortId: true,
      graduateId: true,
      cohort: { select: { name: true, capacity: true } },
      graduate: {
        select: { firstName: true, user: { select: { id: true, email: true, deletedAt: true } } },
      },
    },
  });
  if (!app || (input.graduateId && app.graduateId !== input.graduateId)) {
    throw errors.notFound("Application");
  }

  const { to } = input;
  applicationMachine.assert(app.status, to, input.actor);
  if (to === "REJECTED" && !input.reason) {
    throw errors.badRequest("Give the graduate a reason when rejecting an application");
  }
  if (to === "SHORTLISTED") await assertCohortHasPlace(tx, app.cohortId, app.cohort.capacity);

  const now = new Date();
  // Guarded on the current status so two concurrent moves can't both succeed.
  const { count } = await tx.application.updateMany({
    where: { id: app.id, status: app.status },
    data: {
      status: to,
      statusChangedAt: now,
      ...(to === "REJECTED" ? { rejectionReason: input.reason } : {}),
    },
  });
  if (count === 0)
    throw errors.conflict("This application was changed by someone else. Refresh and try again.");

  await tx.applicationEvent.create({
    data: {
      applicationId: app.id,
      fromStatus: app.status,
      toStatus: to,
      actorId: input.auditActor?.userId ?? null,
      note: input.reason ?? null,
    },
  });
  if (input.note && input.auditActor) {
    await tx.applicationNote.create({
      data: { applicationId: app.id, authorId: input.auditActor.userId, body: input.note },
    });
  }
  if (to === "WITHDRAWN") {
    // A withdrawn graduate can no longer be considered by companies.
    await tx.match.updateMany({
      where: { applicationId: app.id, status: "PROPOSED" },
      data: { status: "WITHDRAWN", decidedAt: now, decisionReason: "Graduate withdrew from the programme" },
    });
  }
  await recordAudit(tx, {
    actor: input.auditActor,
    action: "application.status_changed",
    entityType: "Application",
    entityId: app.id,
    before: { status: app.status },
    after: { status: to },
    ...(input.reason ? { metadata: { hasReason: true } } : {}),
  });
  await createNotification(tx, {
    userId: app.graduate.user.id,
    type: "application.status_changed",
    ...statusNotification(to, app.cohort.name),
    data: { applicationId: app.id, status: to },
  });

  return {
    applicationId: app.id,
    from: app.status,
    to,
    reason: input.reason ?? null,
    cohortName: app.cohort.name,
    recipient: {
      userId: app.graduate.user.id,
      email: app.graduate.user.email,
      firstName: app.graduate.firstName,
      deleted: Boolean(app.graduate.user.deletedAt),
    },
  };
}

async function assertCohortHasPlace(tx: Tx, cohortId: string, capacity: number) {
  // Lock the cohort row so concurrent shortlists can't overfill it.
  await tx.$queryRaw`SELECT "id" FROM "Cohort" WHERE "id" = ${cohortId} FOR UPDATE`;
  const taken = await tx.application.count({ where: { cohortId, status: { in: OCCUPIES_PLACE } } });
  if (taken >= capacity) {
    throw errors.conflict(`This cohort is full (${capacity} places).`);
  }
}

/** Sends the email for a status change, if that status has one. Never throws. */
export async function sendApplicationEmail(change: ApplicationChange) {
  const template = STATUS_EMAIL[change.to];
  if (!template || change.recipient.deleted) return;
  const appUrl = env().APP_URL;
  await sendEmail({
    template,
    to: change.recipient.email,
    toUserId: change.recipient.userId,
    // One email per application per status: a retried action never re-sends.
    idempotencyKey: `${template}:${change.applicationId}`,
    props: {
      firstName: change.recipient.firstName,
      cohortName: change.cohortName,
      dashboardUrl:
        template === "application-rejected"
          ? `${appUrl}/cohorts`
          : `${appUrl}/dashboard/applications/${change.applicationId}`,
      ...(template === "application-rejected" && change.reason ? { reason: change.reason } : {}),
    },
  });
}

// ─── Graduate ─────────────────────────────────────────────────────────────────

export async function applyToCohort(
  user: { id: string; role: AuditActor["role"] },
  graduateId: string,
  input: ApplyInput,
) {
  const now = new Date();
  const [cohort, profile, active] = await Promise.all([
    db.cohort.findUnique({ where: { id: input.cohortId } }),
    db.graduateProfile.findUniqueOrThrow({
      where: { id: graduateId },
      include: { _count: { select: { skills: true } }, user: { select: { email: true } } },
    }),
    db.application.findFirst({
      where: { graduateId, status: { in: ACTIVE } },
      select: { cohort: { select: { name: true } } },
    }),
  ]);

  if (!cohort) throw errors.notFound("Cohort");
  const windowOpen =
    cohort.status === "APPLICATIONS_OPEN" &&
    cohort.applicationOpensAt <= now &&
    cohort.applicationClosesAt > now;
  if (!windowOpen) throw errors.badRequest("Applications for this cohort are not open");

  const missing = missingForApplication({ ...profile, skillCount: profile._count.skills });
  if (missing.length > 0) {
    throw errors.badRequest("Complete your profile before applying", { missing });
  }
  if (active) {
    throw errors.conflict(`You already have an active application (${active.cohort.name})`);
  }

  const change = await db.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: { graduateId, cohortId: cohort.id, motivation: input.motivation ?? null, statusChangedAt: now },
    });
    await tx.applicationEvent.create({
      data: { applicationId: application.id, fromStatus: null, toStatus: "SUBMITTED", actorId: user.id },
    });
    await recordAudit(tx, {
      actor: { userId: user.id, role: user.role },
      action: "application.created",
      entityType: "Application",
      entityId: application.id,
      after: { status: "SUBMITTED", cohortId: cohort.id },
    });
    await createNotification(tx, {
      userId: user.id,
      type: "application.status_changed",
      ...statusNotification("SUBMITTED", cohort.name),
      data: { applicationId: application.id, status: "SUBMITTED" },
    });
    return {
      applicationId: application.id,
      from: null,
      to: "SUBMITTED",
      reason: null,
      cohortName: cohort.name,
      recipient: { userId: user.id, email: profile.user.email, firstName: profile.firstName, deleted: false },
    } satisfies ApplicationChange;
  });

  await sendApplicationEmail(change);
  return getMyApplication(graduateId, change.applicationId);
}

export async function withdrawApplication(
  user: { id: string; role: AuditActor["role"] },
  graduateId: string,
  applicationId: string,
  reason?: string,
) {
  const change = await db.$transaction((tx) =>
    transitionApplication(tx, {
      applicationId,
      to: "WITHDRAWN",
      actor: "GRADUATE",
      auditActor: { userId: user.id, role: user.role },
      reason,
      graduateId,
    }),
  );
  await sendApplicationEmail(change);
  return getMyApplication(graduateId, applicationId);
}

export async function listMyApplications(graduateId: string) {
  const rows = await db.application.findMany({
    where: { graduateId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      statusChangedAt: true,
      cohort: { select: { id: true, name: true, trainingStartsAt: true, internshipStartsAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ ...r, canWithdraw: applicationMachine.can(r.status, "WITHDRAWN", "GRADUATE") }));
}

/** The graduate's view: status and timeline. Internal screening notes are never included. */
export async function getMyApplication(graduateId: string, applicationId: string) {
  const app = await db.application.findFirst({
    where: { id: applicationId, graduateId },
    select: {
      id: true,
      status: true,
      motivation: true,
      rejectionReason: true,
      createdAt: true,
      statusChangedAt: true,
      cohort: {
        select: {
          id: true,
          name: true,
          trainingStartsAt: true,
          trainingEndsAt: true,
          internshipStartsAt: true,
          internshipEndsAt: true,
        },
      },
      events: {
        select: { fromStatus: true, toStatus: true, note: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!app) throw errors.notFound("Application");
  const { events, ...rest } = app;
  return {
    ...rest,
    timeline: events,
    canWithdraw: applicationMachine.can(app.status, "WITHDRAWN", "GRADUATE"),
  };
}

// ─── Admin ────────────────────────────────────────────────────────────────────

const ORDER_BY: Record<AdminApplicationListQuery["sort"], Prisma.ApplicationOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  recently_updated: [{ statusChangedAt: "desc" }, { id: "desc" }],
};

export async function listApplicationsForAdmin(query: AdminApplicationListQuery) {
  const graduate: Prisma.GraduateProfileWhereInput = {
    ...(query.state ? { stateOfResidence: query.state } : {}),
    ...(query.nyscStatus ? { nyscStatus: query.nyscStatus } : {}),
    ...(query.internType ? { internType: query.internType } : {}),
    ...(query.country ? { country: query.country } : {}),
    ...(query.institution ? { institution: { contains: query.institution, mode: "insensitive" } } : {}),
    ...(query.skillId ? { skills: { some: { skillId: query.skillId } } } : {}),
  };
  const where: Prisma.ApplicationWhereInput = {
    ...(query.cohortId ? { cohortId: query.cohortId } : {}),
    ...(query.status?.length ? { status: { in: query.status } } : {}),
    ...(Object.keys(graduate).length > 0 ? { graduate } : {}),
  };
  const rows = await db.application.findMany({
    where,
    select: {
      id: true,
      status: true,
      createdAt: true,
      statusChangedAt: true,
      cohort: { select: { id: true, name: true } },
      graduate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          internType: true,
          country: true,
          city: true,
          stateOfResidence: true,
          institution: true,
          courseOfStudy: true,
          degreeClass: true,
          graduationYear: true,
          nyscStatus: true,
          completenessScore: true,
          skills: { select: { level: true, skill: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: ORDER_BY[query.sort],
    ...cursorArgs(query),
  });
  return toPage(rows, query.limit);
}

export async function getApplicationForAdmin(applicationId: string) {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      cohort: { select: { id: true, name: true, status: true } },
      graduate: {
        include: {
          user: { select: { email: true, emailVerified: true, createdAt: true } },
          skills: { select: { level: true, skill: { select: { id: true, name: true } } } },
        },
      },
      events: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!app) throw errors.notFound("Application");

  const authorIds = [...new Set(app.notes.map((n) => n.authorId))];
  const authors = await db.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, name: true },
  });
  const authorName = new Map(authors.map((a) => [a.id, a.name]));

  // The CV's storage id stays server-side; admins fetch a signed link separately.
  const { cvPublicId, ...graduate } = app.graduate;
  return {
    ...app,
    graduate: { ...graduate, hasCv: Boolean(cvPublicId) },
    notes: app.notes.map((n) => ({ ...n, authorName: authorName.get(n.authorId) ?? null })),
    allowedNextStatuses: applicationMachine.nextStates(app.status, "ADMIN"),
  };
}

export async function changeApplicationStatus(
  actor: AuditActor,
  applicationId: string,
  input: ChangeStatusInput,
) {
  const change = await db.$transaction((tx) =>
    transitionApplication(tx, {
      applicationId,
      to: input.status,
      actor: "ADMIN",
      auditActor: actor,
      reason: input.reason,
      note: input.note,
    }),
  );
  await sendApplicationEmail(change);
  return getApplicationForAdmin(applicationId);
}

export interface BulkResult {
  applicationId: string;
  ok: boolean;
  error?: { code: string; message: string };
}

/**
 * Moves many applications to one status. Each is its own transaction, so one
 * illegal move doesn't block the rest; the result reports each outcome.
 */
export async function bulkChangeApplicationStatus(
  actor: AuditActor,
  input: ChangeStatusInput & { applicationIds: string[] },
) {
  const results: BulkResult[] = [];
  const changes: ApplicationChange[] = [];
  for (const applicationId of input.applicationIds) {
    try {
      const change = await db.$transaction((tx) =>
        transitionApplication(tx, {
          applicationId,
          to: input.status,
          actor: "ADMIN",
          auditActor: actor,
          reason: input.reason,
          note: input.note,
        }),
      );
      changes.push(change);
      results.push({ applicationId, ok: true });
    } catch (err) {
      const e = toAppError(err);
      results.push({ applicationId, ok: false, error: { code: e.code, message: e.message } });
    }
  }
  // Sequential on purpose: stays well within Resend's free-tier rate limit.
  for (const change of changes) await sendApplicationEmail(change);
  return {
    results,
    succeeded: changes.length,
    failed: results.length - changes.length,
  };
}

export async function addApplicationNote(actor: AuditActor, applicationId: string, body: string) {
  return db.$transaction(async (tx) => {
    const exists = await tx.application.findUnique({ where: { id: applicationId }, select: { id: true } });
    if (!exists) throw errors.notFound("Application");
    const note = await tx.applicationNote.create({ data: { applicationId, authorId: actor.userId, body } });
    await recordAudit(tx, {
      actor,
      action: "application.note_added",
      entityType: "Application",
      entityId: applicationId,
      metadata: { noteId: note.id },
    });
    return note;
  });
}
