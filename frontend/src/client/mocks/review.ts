// Demo versions of SIIP's skill review (same rules as
// backend/src/server/services/profile-review.service.ts).
import type { z } from "zod";
import {
  REMOVAL_GRACE_DAYS,
  levelRank,
  profileDecisionSchema,
  skillDecisionSchema,
  type ReviewQueue,
} from "@siip/shared/validators/review";
import { ApiError } from "@/client/api/http";
import type { ReviewDetail, ReviewQueueRow } from "@/client/api/types";
import { audit, db, graduateById, newId, notify, userById, type DbGraduate } from "./db";
import { conflict, currentApplication, notFound, presentSkill, requireAdmin, transition } from "./logic";

const DAY = 24 * 60 * 60 * 1000;
const nameOf = (g: DbGraduate, skillId: string) => {
  const s = g.skills.find((x) => x.id === skillId);
  return s ? presentSkill(s).name : null;
};

function inQueue(g: DbGraduate, queue: ReviewQueue) {
  if (queue === "REMOVED") return Boolean(g.removedAt);
  if (g.removedAt) return false;
  if (queue === "WAITING") {
    return (
      g.reviewStatus === "SUBMITTED" ||
      (g.reviewStatus === "APPROVED" && g.skills.some((s) => s.status === "PENDING" && s.documents.length))
    );
  }
  return g.reviewStatus === queue;
}

export function listReviews(queue: ReviewQueue, q?: string): ReviewQueueRow[] {
  requireAdmin();
  const needle = q && q.length >= 2 ? q.toLowerCase() : null;
  return db.graduates
    .filter((g) => inQueue(g, queue))
    .filter((g) => {
      if (!needle) return true;
      const email = userById(g.userId)?.email ?? "";
      return `${g.firstName} ${g.lastName} ${email}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => (a.submittedAt ?? "9999").localeCompare(b.submittedAt ?? "9999"))
    .map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      email: userById(g.userId)?.email ?? "",
      internType: g.internType,
      country: g.country,
      city: g.city,
      reviewStatus: g.reviewStatus,
      submittedAt: g.submittedAt,
      reviewedAt: g.reviewedAt,
      removedAt: g.removedAt,
      skills: {
        total: g.skills.length,
        pending: g.skills.filter((s) => s.status === "PENDING").length,
        verified: g.skills.filter((s) => s.status === "VERIFIED").length,
        rejected: g.skills.filter((s) => s.status === "REJECTED").length,
        documents: g.skills.reduce((n, s) => n + s.documents.length, 0),
      },
    }));
}

export function getReview(graduateId: string): ReviewDetail {
  requireAdmin();
  const g = graduateById(graduateId);
  if (!g) throw notFound("Profile");
  const user = userById(g.userId)!;
  const ids = new Set([g.id, ...g.skills.map((s) => s.id)]);
  return {
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    otherNames: g.otherNames,
    phone: g.phone,
    internType: g.internType,
    country: g.country,
    city: g.city,
    stateOfResidence: g.stateOfResidence,
    workPreference: g.workPreference,
    availability: g.availability,
    institution: g.institution,
    courseOfStudy: g.courseOfStudy,
    degreeClass: g.degreeClass,
    graduationYear: g.graduationYear,
    nyscStateCode: g.nyscStateCode,
    nyscBatch: g.nyscBatch,
    bio: g.bio,
    hasCv: Boolean(g.cvUploadedAt),
    reviewStatus: g.reviewStatus,
    submittedAt: g.submittedAt,
    reviewedAt: g.reviewedAt,
    reviewNote: g.reviewNote,
    removedAt: g.removedAt,
    removalReason: g.removalReason,
    deleteAfter: g.removedAt ? new Date(new Date(g.removedAt).getTime() + REMOVAL_GRACE_DAYS * DAY).toISOString() : null,
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
    skills: g.skills.map(presentSkill),
    history: db.audit
      .filter((a) => ids.has(a.entityId) && (a.action.startsWith("skill.") || a.action.startsWith("profile.")))
      .map((a) => ({
        id: a.id,
        action: a.action,
        actorName: a.actorName,
        skillName: a.entityType === "GraduateSkill" ? nameOf(g, a.entityId) : null,
        metadata: a.metadata ?? null,
        createdAt: a.createdAt,
      })),
  };
}

export function decideSkill(graduateId: string, skillId: string, input: z.input<typeof skillDecisionSchema>) {
  const admin = requireAdmin();
  const v = skillDecisionSchema.parse(input);
  const g = graduateById(graduateId);
  const skill = g?.skills.find((s) => s.id === skillId);
  if (!g || !skill) throw notFound("Skill");
  if (g.removedAt) throw conflict("This profile has been removed. Reopen it first.");
  const now = new Date().toISOString();
  if (v.decision === "VERIFY") {
    if (!skill.documents.length) throw conflict("This skill has no documents to check");
    if (levelRank(v.level) > levelRank(skill.level)) {
      throw new ApiError("VALIDATION_ERROR", "You can verify a skill at the level claimed or a lower one", 422, [
        { path: "level", message: "Choose the claimed level or a lower one" },
      ]);
    }
    Object.assign(skill, { status: "VERIFIED", verifiedLevel: v.level, rejectionReason: null, reviewedAt: now });
    audit(admin.id, "skill.verified", "GraduateSkill", skill.id, null, { verifiedLevel: v.level }, {
      claimedLevel: skill.level,
      lowerThanClaimed: v.level !== skill.level,
    });
  } else {
    Object.assign(skill, { status: "REJECTED", verifiedLevel: null, rejectionReason: v.reason, reviewedAt: now });
    audit(admin.id, "skill.rejected", "GraduateSkill", skill.id, null, { status: "REJECTED" }, { reason: v.reason });
  }
  return presentSkill(skill);
}

export function decideProfile(graduateId: string, input: z.input<typeof profileDecisionSchema>): ReviewDetail {
  const admin = requireAdmin();
  const v = profileDecisionSchema.parse(input);
  const g = graduateById(graduateId);
  if (!g) throw notFound("Profile");
  const user = userById(g.userId)!;
  const now = new Date().toISOString();

  if (v.action === "RESTORE") {
    if (!g.removedAt) throw conflict("This profile hasn't been removed");
    Object.assign(g, {
      removedAt: null,
      removalReason: null,
      reviewStatus: "CHANGES_REQUESTED",
      reviewNote: v.note,
      reviewedAt: now,
    });
    user.deletedAt = null;
    audit(admin.id, "profile.restored", "GraduateProfile", g.id, null, null, { note: v.note });
    return getReview(graduateId);
  }
  if (g.removedAt) throw conflict("This profile has been removed. Reopen it first.");

  if (v.action === "APPROVE") {
    if (g.reviewStatus !== "SUBMITTED" && g.reviewStatus !== "APPROVED") {
      throw conflict("Only profiles sent for review can be approved");
    }
    const pending = g.skills.filter((s) => s.status === "PENDING").length;
    if (pending) throw conflict(`Decide every skill first (${pending} still to check)`);
    if (!g.skills.some((s) => s.status === "VERIFIED")) throw conflict("Verify at least one skill before approving");
    Object.assign(g, { reviewStatus: "APPROVED", reviewedAt: now, reviewNote: null });
    audit(admin.id, "profile.approved", "GraduateProfile", g.id, null, { reviewStatus: "APPROVED" });
    joinWaitingList(g, admin.id);
    notify(g.userId, "profile.approved", "Your profile is approved", "Your skills are checked. You're on the list for matching with companies.", { href: "/settings" });
    return getReview(graduateId);
  }

  if (v.action === "REQUEST_CHANGES") {
    if (g.reviewStatus !== "SUBMITTED" && g.reviewStatus !== "APPROVED") {
      throw conflict("Only profiles sent for review can be sent back");
    }
    Object.assign(g, { reviewStatus: "CHANGES_REQUESTED", reviewNote: v.note, reviewedAt: now });
    audit(admin.id, "profile.changes_requested", "GraduateProfile", g.id, null, null, { note: v.note });
    notify(g.userId, "profile.changes_requested", "SIIP needs more documents", v.note, { href: "/settings" });
    return getReview(graduateId);
  }

  // REMOVE
  if (db.placements.some((p) => p.graduateId === g.id && p.status === "ACTIVE")) {
    throw conflict("This intern is on an active internship. End it before removing the profile.");
  }
  Object.assign(g, { removedAt: now, removalReason: v.reason, searchable: false });
  user.deletedAt = now;
  for (const a of db.applications.filter((x) => x.graduateId === g.id)) {
    try {
      transition(a, "WITHDRAWN", "ADMIN", admin.id, { reason: "Profile removed by SIIP" });
    } catch {
      // Already finished (completed, rejected or withdrawn).
    }
  }
  db.matches.filter((m) => m.graduateId === g.id && m.status === "PROPOSED").forEach((m) => (m.status = "WITHDRAWN"));
  audit(admin.id, "profile.removed", "GraduateProfile", g.id, null, null, {
    reason: v.reason,
    deleteAfterDays: REMOVAL_GRACE_DAYS,
  });
  return getReview(graduateId);
}

/** Demo: links open as they are; demo files picked by an intern are only in their browser tab. */
const OLD_STEPS = ["SUBMITTED", "SCREENING", "SHORTLISTED", "IN_TRAINING", "FINAL_ASSESSMENT"];
const WAITING_NOTE = "Skills verified by SIIP: on the waiting list for matching";

/** Approved interns are on the waiting list that matching draws from. */
function joinWaitingList(g: DbGraduate, adminId: string) {
  const current = currentApplication(g.id);
  if (current && !OLD_STEPS.includes(current.status)) return;
  if (current) {
    transition(current, "QUALIFIED", "SYSTEM", adminId, { reason: WAITING_NOTE });
    return;
  }
  const now = new Date().toISOString();
  db.applications.push({
    id: newId("app"),
    graduateId: g.id,
    cohortId: null,
    status: "QUALIFIED",
    motivation: null,
    rejectionReason: null,
    createdAt: now,
    statusChangedAt: now,
    events: [{ fromStatus: null, toStatus: "QUALIFIED", actorId: adminId, note: WAITING_NOTE, createdAt: now }],
    notes: [],
  });
}

export function getSkillDocumentUrl(documentId: string) {
  const admin = requireAdmin();
  for (const g of db.graduates) {
    const doc = g.skills.flatMap((s) => s.documents).find((d) => d.id === documentId);
    if (doc) {
      audit(admin.id, "skill_document.viewed", "SkillDocument", doc.id, null, null, { graduateId: g.id });
      return { url: doc.kind === "LINK" ? doc.url! : "#", kind: doc.kind };
    }
  }
  throw notFound("Document");
}
