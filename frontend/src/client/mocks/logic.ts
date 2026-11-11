// Mock equivalents of the backend's guards, presenters and state machines.
import type { ApplicationStatus } from "@siip/shared/enums";
import { computeCompleteness, missingForApplication } from "@siip/shared/profile-completeness";
import { ApiError } from "@/client/api/http";
import type {
  GraduateSkill,
  AdminApplicationRow,
  GraduateProfile,
  LimitedGraduate,
  Opening,
  Placement,
} from "@/client/api/types";
import { currentPersona } from "@/client/session";
import { APPLICATION_STATUS } from "@/lib/labels";
import {
  audit,
  bestFinal,
  cohortById,
  companyById,
  db,
  graduateById,
  iso,
  newId,
  notify,
  openingById,
  skillName,
  type DbGraduateSkill,
  verifiedSkills,
  userById,
  type DbApplication,
  type DbGraduate,
  type DbOpening,
  type DbPlacement,
} from "./db";
import { currentUserId } from "./me";

// ─── Guards (same error codes as the backend) ─────────────────────────────────

export function requireUser() {
  const user = userById(currentUserId(currentPersona()) ?? "");
  if (!user) throw new ApiError("UNAUTHENTICATED", "You need to sign in", 401);
  return user;
}

export function requireGraduate() {
  const user = requireUser();
  const graduate = db.graduates.find((g) => g.userId === user.id);
  if (user.role !== "GRADUATE" || !graduate)
    throw new ApiError("FORBIDDEN", "You do not have permission to do this", 403);
  return { user, graduate };
}

export function requireMember(opts: { ownerOnly?: boolean } = {}) {
  const user = requireUser();
  const member = db.members.find((m) => m.userId === user.id);
  if (user.role !== "COMPANY_MEMBER")
    throw new ApiError("FORBIDDEN", "You do not have permission to do this", 403);
  if (!member) throw new ApiError("FORBIDDEN", "Register your company first", 403);
  if (opts.ownerOnly && member.role !== "OWNER")
    throw new ApiError("FORBIDDEN", "Only the company owner can do this", 403);
  return { user, member, company: companyById(member.companyId)! };
}

export function requireAdmin() {
  const user = requireUser();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    throw new ApiError("FORBIDDEN", "You do not have permission to do this", 403);
  return user;
}

export const notFound = (what: string) => new ApiError("NOT_FOUND", `${what} not found`, 404);
export const conflict = (msg: string) => new ApiError("CONFLICT", msg, 409);
export const badRequest = (msg: string, details?: unknown) => new ApiError("BAD_REQUEST", msg, 400, details);

// ─── Application state machine (mirrors backend/src/server/lib/state-machine.ts) ─

type Actor = "ADMIN" | "GRADUATE" | "COMPANY" | "SYSTEM";
const A: Actor[] = ["ADMIN"],
  S: Actor[] = ["SYSTEM"],
  AS: Actor[] = ["ADMIN", "SYSTEM"],
  AG: Actor[] = ["ADMIN", "GRADUATE"];
const APP_TABLE: Record<ApplicationStatus, Partial<Record<ApplicationStatus, Actor[]>>> = {
  SUBMITTED: { SCREENING: AS, REJECTED: A, WITHDRAWN: AG },
  SCREENING: { SHORTLISTED: A, REJECTED: A, WITHDRAWN: AG },
  SHORTLISTED: { IN_TRAINING: AS, REJECTED: A, WITHDRAWN: AG },
  IN_TRAINING: { FINAL_ASSESSMENT: AS, REJECTED: A, WITHDRAWN: AG },
  FINAL_ASSESSMENT: { QUALIFIED: AS, REJECTED: AS, WITHDRAWN: AG },
  QUALIFIED: { MATCHED: S, WITHDRAWN: AG },
  MATCHED: { PLACED: S, QUALIFIED: S, WITHDRAWN: AG },
  PLACED: { COMPLETED: S },
  COMPLETED: {},
  REJECTED: {},
  WITHDRAWN: {},
};
export const canMove = (from: ApplicationStatus, to: ApplicationStatus, actor: Actor) =>
  APP_TABLE[from]?.[to]?.includes(actor) ?? false;
export const nextStates = (from: ApplicationStatus, actor: Actor) =>
  (Object.keys(APP_TABLE[from]) as ApplicationStatus[]).filter((to) => canMove(from, to, actor));

export function transition(
  app: DbApplication,
  to: ApplicationStatus,
  actor: Actor,
  actorId: string | null,
  opts: { reason?: string; note?: string } = {},
) {
  if (!canMove(app.status, to, actor))
    throw new ApiError("INVALID_TRANSITION", `Application cannot move from ${app.status} to ${to}`, 409);
  if (to === "REJECTED" && !opts.reason)
    throw badRequest("Give the graduate a reason when rejecting an application");
  if (to === "SHORTLISTED") {
    const cohort = cohortById(app.cohortId)!;
    const taken = db.applications.filter(
      (a) =>
        a.cohortId === app.cohortId &&
        [
          "SHORTLISTED",
          "IN_TRAINING",
          "FINAL_ASSESSMENT",
          "QUALIFIED",
          "MATCHED",
          "PLACED",
          "COMPLETED",
        ].includes(a.status),
    ).length;
    if (taken >= cohort.capacity) throw conflict(`This cohort is full (${cohort.capacity} places).`);
  }
  const before = app.status;
  const now = new Date().toISOString();
  app.status = to;
  app.statusChangedAt = now;
  if (to === "REJECTED") app.rejectionReason = opts.reason ?? null;
  app.events.push({ fromStatus: before, toStatus: to, actorId, note: opts.reason ?? null, createdAt: now });
  if (opts.note && actorId)
    app.notes.unshift({
      id: newId("note"),
      body: opts.note,
      authorId: actorId,
      authorName: userById(actorId)?.name ?? null,
      createdAt: now,
    });
  if (to === "WITHDRAWN") {
    db.matches
      .filter((m) => m.applicationId === app.id && m.status === "PROPOSED")
      .forEach((m) => {
        m.status = "WITHDRAWN";
        m.decidedAt = now;
      });
  }
  audit(actorId, "application.status_changed", "Application", app.id, { status: before }, { status: to });
  const g = graduateById(app.graduateId)!;
  notify(
    g.userId,
    "application.status_changed",
    APPLICATION_STATUS[to].label,
    `Your application to ${cohortById(app.cohortId)!.name} is now: ${APPLICATION_STATUS[to].label.toLowerCase()}.`,
    { applicationId: app.id, status: to },
  );
}

export function currentApplication(graduateId: string) {
  return db.applications
    .filter((a) => a.graduateId === graduateId && a.status !== "REJECTED" && a.status !== "WITHDRAWN")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

// ─── Presenters (same shapes as the backend responses) ────────────────────────

export function scoringInput(g: DbGraduate) {
  return { ...g, cvPublicId: g.cvUploadedAt, skillCount: g.skills.length };
}

/** A skill as its owner and SIIP admins see it (same shape as the backend's presentSkill). */
export function presentSkill(s: DbGraduateSkill): GraduateSkill {
  const cat = s.skillId ? db.skills.find((x) => x.id === s.skillId) : undefined;
  return {
    id: s.id,
    skillId: s.skillId,
    name: cat?.name ?? s.otherName ?? "Skill",
    category: cat?.category ?? "Other",
    isOther: !s.skillId,
    level: s.level,
    verifiedLevel: s.verifiedLevel,
    status: s.status,
    rejectionReason: s.rejectionReason,
    issuingBody: s.issuingBody,
    issuedAt: s.issuedAt,
    reviewedAt: s.reviewedAt,
    createdAt: s.createdAt,
    documents: s.documents.map((d) => ({ ...d, url: d.kind === "LINK" ? d.url : null })),
  };
}

export function presentProfile(g: DbGraduate): GraduateProfile {
  const input = scoringInput(g);
  return {
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    otherNames: g.otherNames,
    phone: g.phone,
    internType: g.internType,
    country: g.country,
    city: g.city,
    workPreference: g.workPreference,
    stateOfResidence: g.stateOfResidence,
    lga: g.lga,
    institution: g.institution,
    courseOfStudy: g.courseOfStudy,
    degreeClass: g.degreeClass,
    graduationYear: g.graduationYear,
    nyscStatus: g.nyscStatus,
    currentPpa: g.currentPpa,
    nyscStateCode: g.nyscStateCode,
    nyscBatch: g.nyscBatch,
    availability: g.availability,
    bio: g.bio,
    cv: { uploaded: Boolean(g.cvUploadedAt), uploadedAt: g.cvUploadedAt },
    photoUrl: g.photoUrl,
    completenessScore: computeCompleteness(input),
    searchable: g.searchable,
    visibility: g.visibility,
    skills: g.skills.map(presentSkill),
    missingForApplication: missingForApplication(input),
    skillsWithoutProof: g.skills.filter((s) => s.documents.length === 0).map((s) => presentSkill(s).name),
    reviewStatus: g.reviewStatus,
    submittedAt: g.submittedAt,
    reviewedAt: g.reviewedAt,
    reviewNote: g.reviewNote,
    updatedAt: g.updatedAt,
  };
}

export function limitedGraduate(g: DbGraduate): LimitedGraduate {
  return {
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    internType: g.internType,
    country: g.country,
    city: g.city,
    workPreference: g.workPreference,
    stateOfResidence: g.stateOfResidence,
    institution: g.institution,
    courseOfStudy: g.courseOfStudy,
    degreeClass: g.degreeClass,
    graduationYear: g.graduationYear,
    nyscStatus: g.nyscStatus,
    availability: g.availability,
    bio: g.bio,
    photoUrl: g.photoUrl,
    finalAssessmentPercent: bestFinal(g.id),
    // Companies only ever see verified skills, at the verified level.
    skills: verifiedSkills(g).map((s) => ({ id: s.skillId, name: skillName(s.skillId), level: s.level })),
  };
}

export function adminRow(a: DbApplication): AdminApplicationRow {
  const g = graduateById(a.graduateId)!;
  return {
    id: a.id,
    status: a.status,
    createdAt: a.createdAt,
    statusChangedAt: a.statusChangedAt,
    cohort: { id: a.cohortId, name: cohortById(a.cohortId)!.name },
    graduate: {
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      internType: g.internType,
      country: g.country,
      city: g.city,
      stateOfResidence: g.stateOfResidence,
      institution: g.institution,
      courseOfStudy: g.courseOfStudy,
      degreeClass: g.degreeClass,
      graduationYear: g.graduationYear,
      nyscStatus: g.nyscStatus,
      completenessScore: computeCompleteness(scoringInput(g)),
      reviewStatus: g.reviewStatus,
      skills: g.skills.map((s) => ({
        level: s.level,
        verifiedLevel: s.verifiedLevel,
        status: s.status,
        otherName: s.otherName,
        skill: s.skillId ? { id: s.skillId, name: skillName(s.skillId) } : null,
      })),
    },
  };
}

export function presentOpening(o: DbOpening, withCompany = false): Opening {
  const company = companyById(o.companyId)!;
  return {
    ...o,
    skills: o.skills.map((s) => ({
      required: s.required,
      minLevel: s.minLevel,
      skill: { id: s.skillId, name: skillName(s.skillId) },
    })),
    _count: {
      matches: db.matches.filter((m) => m.openingId === o.id).length,
      placements: db.placements.filter((p) => p.openingId === o.id && p.status !== "TERMINATED").length,
    },
    ...(withCompany
      ? { company: { id: company.id, name: company.name, verificationStatus: company.verificationStatus } }
      : {}),
  };
}

export function presentPlacement(
  p: DbPlacement,
  opts: { contact?: boolean; companyDetails?: boolean } = {},
): Placement {
  const o = openingById(p.openingId)!;
  const c = companyById(p.companyId)!;
  const g = graduateById(p.graduateId)!;
  const sup = p.supervisorId ? db.members.find((m) => m.id === p.supervisorId) : undefined;
  const supUser = sup ? userById(sup.userId) : undefined;
  return {
    id: p.id,
    status: p.status,
    startDate: p.startDate,
    endDate: p.endDate,
    endedAt: p.endedAt,
    endReason: p.endReason,
    offeredPermanentRole: p.offeredPermanentRole,
    permanentOfferDate: p.permanentOfferDate,
    createdAt: p.createdAt,
    opening: {
      id: o.id,
      title: o.title,
      workMode: o.workMode,
      country: o.country,
      city: o.city,
      state: o.state,
      location: o.location,
    },
    company: opts.companyDetails
      ? {
          id: c.id,
          name: c.name,
          address: c.address,
          country: c.country,
          city: c.city,
          state: c.state,
          website: c.website,
          logoUrl: c.logoUrl,
          industry: c.industry,
        }
      : { id: c.id, name: c.name },
    supervisor:
      sup && supUser
        ? { id: sup.id, jobTitle: sup.jobTitle, user: { name: supUser.name, email: supUser.email } }
        : null,
    graduate: opts.contact
      ? {
          id: g.id,
          firstName: g.firstName,
          lastName: g.lastName,
          phone: g.phone,
          institution: g.institution,
          courseOfStudy: g.courseOfStudy,
          photoUrl: g.photoUrl,
          user: { email: userById(g.userId)!.email },
        }
      : { id: g.id, firstName: g.firstName, lastName: g.lastName },
  };
}

// ─── Assessment scoring (mirrors backend/src/server/lib/assessment-scoring.ts) ─

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");

export function scoreAttemptMock(attemptId: string) {
  const t = db.attempts.find((x) => x.id === attemptId)!;
  const a = db.assessments.find((x) => x.id === t.assessmentId)!;
  const inLayout = new Set(t.layout.map((l) => l.questionId));
  let score = 0,
    max = 0;
  for (const q of a.questions.filter((x) => inLayout.has(x.id))) {
    max += q.points;
    const ans = t.answers[q.id];
    if (!ans) continue;
    const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    const sel = [...new Set(ans.selectedOptionIds)];
    const ok =
      q.type === "SHORT_TEXT"
        ? !!ans.textAnswer && q.acceptedAnswers.some((x) => norm(x) === norm(ans.textAnswer!))
        : q.type === "SINGLE_CHOICE"
          ? sel.length === 1 && correct.includes(sel[0])
          : sel.length === correct.length && sel.every((x) => correct.includes(x));
    if (ok) score += q.points;
  }
  const percentage = max === 0 ? 0 : Math.round((score / max) * 10000) / 100;
  return { score, max, percentage, passed: percentage >= a.passMark };
}

export const isoNow = () => new Date().toISOString();
export { iso };
