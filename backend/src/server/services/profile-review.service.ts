// SIIP's review of an intern's skills and documents.
//
// Each skill is decided on its own: verified at the claimed level or a lower
// one, or rejected with a reason. The profile is then approved (only approved
// interns can be matched), sent back for more documents, or removed. Removal
// locks the account at once; the daily cron deletes it after the grace period,
// and until then an admin can reopen it. Every action is audit-logged with its
// reason.
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { env } from "@/server/env";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { AppError, errors } from "@/server/lib/errors";
import { applicationMachine } from "@/server/lib/state-machine";
import { cursorArgs, toPage } from "@/server/lib/pagination";
import {
  REMOVAL_GRACE_DAYS,
  levelRank,
  type ProfileDecisionInput,
  type SkillDecisionInput,
} from "@/server/validators/review";
import type { z } from "zod";
import type { reviewQueueQuery } from "@/server/validators/review";
import { sendApplicationEmail, transitionApplication, type ApplicationChange } from "./application.service";
import { createNotification } from "./notification.service";
import { presentSkill, skillSelect } from "./skill.service";

const DAY = 24 * 60 * 60 * 1000;

// ─── The queue ────────────────────────────────────────────────────────────────

function queueWhere(queue: z.infer<typeof reviewQueueQuery>["queue"]): Prisma.GraduateProfileWhereInput {
  switch (queue) {
    case "WAITING":
      return {
        removedAt: null,
        OR: [
          { reviewStatus: "SUBMITTED" },
          // Approved interns who added a skill since: that skill still needs checking.
          { reviewStatus: "APPROVED", skills: { some: { status: "PENDING", documents: { some: {} } } } },
        ],
      };
    case "REMOVED":
      return { removedAt: { not: null } };
    default:
      return { removedAt: null, reviewStatus: queue };
  }
}

export async function listReviewQueue(query: z.infer<typeof reviewQueueQuery>) {
  const rows = await db.graduateProfile.findMany({
    where: {
      ...queueWhere(query.queue),
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: "insensitive" } },
              { lastName: { contains: query.q, mode: "insensitive" } },
              { user: { email: { contains: query.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      internType: true,
      country: true,
      city: true,
      reviewStatus: true,
      submittedAt: true,
      reviewedAt: true,
      removedAt: true,
      user: { select: { email: true } },
      skills: { select: { status: true, _count: { select: { documents: true } } } },
    },
    // Oldest first, so nobody waits longest.
    orderBy: [{ submittedAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    ...cursorArgs(query),
  });
  const page = toPage(rows, query.limit);
  return {
    ...page,
    items: page.items.map(({ skills, user, ...p }) => ({
      ...p,
      email: user.email,
      skills: {
        total: skills.length,
        pending: skills.filter((s) => s.status === "PENDING").length,
        verified: skills.filter((s) => s.status === "VERIFIED").length,
        rejected: skills.filter((s) => s.status === "REJECTED").length,
        documents: skills.reduce((n, s) => n + s._count.documents, 0),
      },
    })),
  };
}

/** Everything an admin needs to decide: the profile, each skill with its documents, and the history. */
export async function getReview(graduateId: string) {
  const profile = await db.graduateProfile.findUnique({
    where: { id: graduateId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      otherNames: true,
      phone: true,
      internType: true,
      country: true,
      city: true,
      stateOfResidence: true,
      workPreference: true,
      availability: true,
      institution: true,
      courseOfStudy: true,
      degreeClass: true,
      graduationYear: true,
      nyscStateCode: true,
      nyscBatch: true,
      bio: true,
      cvPublicId: true,
      reviewStatus: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNote: true,
      removedAt: true,
      removalReason: true,
      user: { select: { id: true, email: true, createdAt: true } },
      skills: { select: skillSelect, orderBy: { createdAt: "asc" } },
    },
  });
  if (!profile) throw errors.notFound("Profile");
  const skillIds = profile.skills.map((s) => s.id);
  const history = await db.auditLog.findMany({
    where: {
      OR: [
        { entityType: "GraduateProfile", entityId: graduateId },
        { entityType: "GraduateSkill", entityId: { in: skillIds } },
      ],
    },
    select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true, actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const skillName = new Map(profile.skills.map((s) => [s.id, presentSkill(s).name]));
  const { cvPublicId, skills, ...rest } = profile;
  return {
    ...rest,
    hasCv: Boolean(cvPublicId),
    deleteAfter: profile.removedAt ? new Date(profile.removedAt.getTime() + REMOVAL_GRACE_DAYS * DAY) : null,
    skills: skills.map(presentSkill),
    history: history.map((h) => ({
      id: h.id,
      action: h.action,
      actorName: h.actor?.name ?? null,
      skillName: h.entityType === "GraduateSkill" ? (skillName.get(h.entityId) ?? null) : null,
      metadata: h.metadata,
      createdAt: h.createdAt,
    })),
  };
}

// ─── Deciding one skill ───────────────────────────────────────────────────────

export async function decideSkill(
  actor: AuditActor,
  graduateId: string,
  graduateSkillId: string,
  input: SkillDecisionInput,
) {
  return db.$transaction(async (tx) => {
    const skill = await tx.graduateSkill.findFirst({
      where: { id: graduateSkillId, graduateId },
      select: {
        id: true,
        level: true,
        status: true,
        verifiedLevel: true,
        graduate: { select: { removedAt: true } },
        _count: { select: { documents: true } },
      },
    });
    if (!skill) throw errors.notFound("Skill");
    if (skill.graduate.removedAt) throw errors.conflict("This profile has been removed. Reopen it first.");

    const now = new Date();
    if (input.decision === "VERIFY") {
      if (skill._count.documents === 0) throw errors.conflict("This skill has no documents to check");
      if (levelRank(input.level) > levelRank(skill.level)) {
        throw new AppError("VALIDATION_ERROR", "You can verify a skill at the level claimed or a lower one", [
          { path: "level", message: "Choose the claimed level or a lower one" },
        ]);
      }
      await tx.graduateSkill.update({
        where: { id: graduateSkillId },
        data: { status: "VERIFIED", verifiedLevel: input.level, rejectionReason: null, reviewedAt: now, reviewedById: actor?.userId ?? null },
      });
    } else {
      await tx.graduateSkill.update({
        where: { id: graduateSkillId },
        data: { status: "REJECTED", verifiedLevel: null, rejectionReason: input.reason, reviewedAt: now, reviewedById: actor?.userId ?? null },
      });
    }
    await recordAudit(tx, {
      actor,
      action: input.decision === "VERIFY" ? "skill.verified" : "skill.rejected",
      entityType: "GraduateSkill",
      entityId: graduateSkillId,
      before: { status: skill.status, verifiedLevel: skill.verifiedLevel },
      after:
        input.decision === "VERIFY"
          ? { status: "VERIFIED", verifiedLevel: input.level }
          : { status: "REJECTED" },
      metadata: {
        graduateId,
        claimedLevel: skill.level,
        ...(input.decision === "VERIFY"
          ? { lowerThanClaimed: input.level !== skill.level }
          : { reason: input.reason }),
      },
    });
    return presentSkill(await tx.graduateSkill.findUniqueOrThrow({ where: { id: graduateSkillId }, select: skillSelect }));
  });
}

// ─── Deciding the profile ─────────────────────────────────────────────────────

type ProfileForDecision = {
  id: string;
  firstName: string;
  reviewStatus: string;
  removedAt: Date | null;
  user: { id: string; email: string; deletedAt: Date | null };
  skills: Array<{ status: string; skill: { name: string } | null; otherName: string | null }>;
};

async function loadForDecision(tx: Tx, graduateId: string): Promise<ProfileForDecision> {
  const p = await tx.graduateProfile.findUnique({
    where: { id: graduateId },
    select: {
      id: true,
      firstName: true,
      reviewStatus: true,
      removedAt: true,
      user: { select: { id: true, email: true, deletedAt: true } },
      skills: { select: { status: true, otherName: true, skill: { select: { name: true } } } },
    },
  });
  if (!p) throw errors.notFound("Profile");
  return p;
}

const profileUrl = () => `${env().APP_URL}/settings`;

export async function decideProfile(actor: AuditActor, graduateId: string, input: ProfileDecisionInput) {
  const outcome = await db.$transaction(async (tx) => {
    const p = await loadForDecision(tx, graduateId);
    const now = new Date();
    const audit = (action: string, after: Prisma.InputJsonObject, metadata: Prisma.InputJsonObject = {}) =>
      recordAudit(tx, {
        actor,
        action,
        entityType: "GraduateProfile",
        entityId: graduateId,
        before: { reviewStatus: p.reviewStatus, removed: Boolean(p.removedAt) },
        after,
        metadata,
      });

    if (input.action === "RESTORE") {
      if (!p.removedAt) throw errors.conflict("This profile hasn't been removed");
      await tx.user.update({ where: { id: p.user.id }, data: { deletedAt: null } });
      await tx.graduateProfile.update({
        where: { id: graduateId },
        data: {
          removedAt: null,
          removalReason: null,
          removedById: null,
          reviewStatus: "CHANGES_REQUESTED",
          reviewNote: input.note,
          reviewedAt: now,
        },
      });
      await audit("profile.restored", { reviewStatus: "CHANGES_REQUESTED", removed: false }, { note: input.note });
      return { kind: "restored" as const, p, note: input.note };
    }

    if (p.removedAt) throw errors.conflict("This profile has been removed. Reopen it first.");

    if (input.action === "APPROVE") {
      if (p.reviewStatus !== "SUBMITTED" && p.reviewStatus !== "APPROVED") {
        throw errors.conflict("Only profiles sent for review can be approved");
      }
      const pending = p.skills.filter((s) => s.status === "PENDING").length;
      if (pending) throw errors.conflict(`Decide every skill first (${pending} still to check)`);
      const verified = p.skills.filter((s) => s.status === "VERIFIED");
      if (!verified.length) throw errors.conflict("Verify at least one skill before approving");
      await tx.graduateProfile.update({
        where: { id: graduateId },
        data: { reviewStatus: "APPROVED", reviewedAt: now, reviewNote: null },
      });
      await audit("profile.approved", { reviewStatus: "APPROVED" }, { verifiedSkills: verified.length });
      await createNotification(tx, {
        userId: p.user.id,
        type: "profile.approved",
        title: "Your profile is approved",
        body: "Your skills are checked. You're on the list for matching with companies.",
        data: { href: "/settings" },
      });
      return { kind: "approved" as const, p, verified: verified.map((s) => s.skill?.name ?? s.otherName ?? "Skill") };
    }

    if (input.action === "REQUEST_CHANGES") {
      if (p.reviewStatus !== "SUBMITTED" && p.reviewStatus !== "APPROVED") {
        throw errors.conflict("Only profiles sent for review can be sent back");
      }
      await tx.graduateProfile.update({
        where: { id: graduateId },
        data: { reviewStatus: "CHANGES_REQUESTED", reviewNote: input.note, reviewedAt: now },
      });
      await audit("profile.changes_requested", { reviewStatus: "CHANGES_REQUESTED" }, { note: input.note });
      await createNotification(tx, {
        userId: p.user.id,
        type: "profile.changes_requested",
        title: "SIIP needs more documents",
        body: input.note,
        data: { href: "/settings" },
      });
      return { kind: "changes" as const, p, note: input.note };
    }

    // REMOVE: lock the account now; the daily cron deletes it after the grace period.
    const active = await tx.placement.findFirst({
      where: { graduateId, status: "ACTIVE" },
      select: { id: true },
    });
    if (active) throw errors.conflict("This intern is on an active internship. End it before removing the profile.");
    await tx.user.update({ where: { id: p.user.id }, data: { deletedAt: now } });
    await tx.session.deleteMany({ where: { userId: p.user.id } });
    await tx.graduateProfile.update({
      where: { id: graduateId },
      data: { removedAt: now, removalReason: input.reason, removedById: actor?.userId ?? null, searchable: false },
    });
    const changes: ApplicationChange[] = [];
    const apps = await tx.application.findMany({ where: { graduateId }, select: { id: true, status: true } });
    for (const app of apps) {
      if (!applicationMachine.can(app.status, "WITHDRAWN", "ADMIN")) continue;
      changes.push(
        await transitionApplication(tx, {
          applicationId: app.id,
          to: "WITHDRAWN",
          actor: "ADMIN",
          auditActor: actor,
          reason: "Profile removed by SIIP",
        }),
      );
    }
    // Open proposals to companies are withdrawn too.
    await tx.match.updateMany({ where: { graduateId, status: "PROPOSED" }, data: { status: "WITHDRAWN" } });
    await audit("profile.removed", { removed: true }, { reason: input.reason, deleteAfterDays: REMOVAL_GRACE_DAYS });
    return { kind: "removed" as const, p, reason: input.reason, changes };
  });

  // Emails go after commit; a failed email never undoes the decision.
  const { p } = outcome;
  if (outcome.kind === "approved") {
    await sendEmail({
      template: "profile-approved",
      to: p.user.email,
      toUserId: p.user.id,
      props: { firstName: p.firstName, verifiedSkills: outcome.verified, profileUrl: profileUrl() },
      idempotencyKey: `profile-approved:${graduateId}:${Date.now()}`,
    });
  } else if (outcome.kind === "changes" || outcome.kind === "restored") {
    await sendEmail({
      template: "profile-changes-requested",
      to: p.user.email,
      toUserId: p.user.id,
      props: { firstName: p.firstName, note: outcome.note, profileUrl: profileUrl() },
      idempotencyKey: `profile-changes:${graduateId}:${Date.now()}`,
    });
  } else {
    // Sent although the account is locked: the intern must know why.
    await sendEmail({
      template: "profile-removed",
      to: p.user.email,
      toUserId: p.user.id,
      props: {
        firstName: p.firstName,
        reason: outcome.reason,
        deleteAfterDays: REMOVAL_GRACE_DAYS,
        supportEmail: env().SUPPORT_EMAIL ?? null,
      },
      idempotencyKey: `profile-removed:${graduateId}:${Date.now()}`,
    });
    for (const change of outcome.changes) await sendApplicationEmail(change);
  }
  return getReview(graduateId);
}
