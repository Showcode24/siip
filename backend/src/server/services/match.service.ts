import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { MatchSource } from "@/generated/prisma/enums";
import { toAuditActor, type CompanyContext } from "@/server/auth/session";
import { db, type Tx } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { env } from "@/server/env";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import { scoreMatch, type MatchCandidate } from "@/server/lib/matching";
import { cursorArgs, toPage } from "@/server/lib/pagination";
import { matchMachine } from "@/server/lib/state-machine";
import type { acceptMatchSchema, matchListQuery } from "@/server/validators/matching";
import { sendApplicationEmail, transitionApplication, type ApplicationChange } from "./application.service";
import { getCvDownloadUrl } from "./graduate.service";
import { createNotification } from "./notification.service";

/** Placements that use up one of an opening's slots. */
const FILLS_SLOT: Prisma.PlacementWhereInput = { status: { in: ["ACTIVE", "COMPLETED"] } };
const fmt = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || "there";

// Fields a company may see before accepting: no phone, email, CV or exact address.
const limitedGraduateSelect = {
  id: true,
  firstName: true,
  lastName: true,
  internType: true,
  country: true,
  city: true,
  workPreference: true,
  stateOfResidence: true,
  institution: true,
  courseOfStudy: true,
  degreeClass: true,
  graduationYear: true,
  nyscStatus: true,
  availability: true,
  bio: true,
  photoUrl: true,
  // Companies and matching only ever see skills SIIP has verified, at the verified level.
  skills: {
    where: { status: "VERIFIED", skillId: { not: null }, verifiedLevel: { not: null } },
    select: { skillId: true, verifiedLevel: true, skill: { select: { name: true } } },
  },
  attempts: {
    where: { assessment: { type: "FINAL" }, percentage: { not: null } },
    select: { percentage: true },
  },
} as const;

type LimitedGraduate = {
  skills: Array<{
    skillId: string | null;
    verifiedLevel: MatchCandidate["skills"][number]["level"] | null;
    skill: { name: string } | null;
  }>;
  attempts: Array<{ percentage: number | null }>;
} & Omit<MatchCandidate, "skills" | "finalAssessmentPercent">;

function bestFinal(attempts: Array<{ percentage: number | null }>) {
  const scores = attempts.map((a) => a.percentage ?? 0);
  return scores.length ? Math.max(...scores) : null;
}

/** Verified skills only (the query already filters; this narrows the types). */
function verifiedSkills(g: LimitedGraduate) {
  return g.skills.flatMap((s) =>
    s.skillId && s.verifiedLevel ? [{ skillId: s.skillId, level: s.verifiedLevel, name: s.skill?.name ?? "Skill" }] : [],
  );
}

function toCandidate(g: LimitedGraduate): MatchCandidate {
  return {
    ...g,
    skills: verifiedSkills(g).map(({ skillId, level }) => ({ skillId, level })),
    finalAssessmentPercent: bestFinal(g.attempts),
  };
}

/** Graduate profile as a company sees it before accepting. */
function presentLimited<G extends LimitedGraduate>(g: G) {
  const { attempts, skills, ...rest } = g;
  return {
    ...rest,
    finalAssessmentPercent: bestFinal(attempts),
    skills: verifiedSkills({ ...g, skills }).map((s) => ({ id: s.skillId, name: s.name, level: s.level })),
  };
}

async function loadOpeningForMatching(client: Tx | typeof db, openingId: string) {
  const opening = await client.internshipOpening.findUnique({
    where: { id: openingId },
    include: {
      skills: { select: { skillId: true, minLevel: true, required: true } },
      company: { select: { id: true, name: true, verificationStatus: true } },
      _count: { select: { placements: { where: FILLS_SLOT } } },
    },
  });
  if (!opening) throw errors.notFound("Opening");
  return opening;
}

function assertOpeningAcceptsMatches(opening: Awaited<ReturnType<typeof loadOpeningForMatching>>) {
  if (opening.status !== "OPEN") throw errors.conflict("This opening is not open");
  if (opening.company.verificationStatus !== "VERIFIED")
    throw errors.conflict("This company is not verified");
  if (opening._count.placements >= opening.slots)
    throw errors.conflict("All slots for this opening are filled");
}

// ─── Admin: suggestions and proposals ─────────────────────────────────────────

/** Qualified graduates ranked for an opening, with the reasons for each score. */
export async function getSuggestions(openingId: string, limit: number) {
  const opening = await loadOpeningForMatching(db, openingId);
  const apps = await db.application.findMany({
    where: {
      status: "QUALIFIED",
      ...(opening.cohortId ? { cohortId: opening.cohortId } : {}),
      // Only interns SIIP has approved (and not removed) are ever put in front of companies.
      graduate: { reviewStatus: "APPROVED", removedAt: null, user: { deletedAt: null } },
      // Don't suggest someone this opening has already declined.
      matches: { none: { openingId, status: "COMPANY_REJECTED" } },
    },
    select: { id: true, cohortId: true, graduate: { select: limitedGraduateSelect } },
    take: 2000,
  });
  const ranked = apps
    .map((a) => ({ app: a, score: scoreMatch(toCandidate(a.graduate), opening) }))
    .filter((r) => r.score.eligible)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit);
  return {
    opening: {
      id: opening.id,
      title: opening.title,
      company: opening.company,
      slots: opening.slots,
      filled: opening._count.placements,
      status: opening.status,
    },
    suggestions: ranked.map(({ app, score }) => ({
      applicationId: app.id,
      cohortId: app.cohortId,
      score: score.total,
      breakdown: score.breakdown,
      graduate: presentLimited(app.graduate),
    })),
  };
}

export interface CreateMatchInput {
  openingId: string;
  applicationId: string;
  source: MatchSource;
  actor: AuditActor;
}

/**
 * The one way a Match is created. Admin proposals use it now; Phase 2 company
 * requests will call it with source COMPANY_REQUEST.
 */
export async function createMatch(tx: Tx, input: CreateMatchInput) {
  // Serialise proposals per opening so slot checks are reliable.
  await tx.$queryRaw`SELECT "id" FROM "InternshipOpening" WHERE "id" = ${input.openingId} FOR UPDATE`;
  const opening = await loadOpeningForMatching(tx, input.openingId);
  assertOpeningAcceptsMatches(opening);

  const app = await tx.application.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      cohortId: true,
      graduateId: true,
      graduate: {
        select: { ...limitedGraduateSelect, reviewStatus: true, removedAt: true, user: { select: { deletedAt: true } } },
      },
    },
  });
  if (!app) throw errors.notFound("Application");
  const g = app.graduate;
  if (g.reviewStatus !== "APPROVED" || g.removedAt || g.user.deletedAt) {
    throw errors.conflict("Only interns whose skills SIIP has approved can be matched");
  }
  if (opening.cohortId && opening.cohortId !== app.cohortId) {
    throw errors.badRequest("This opening is for a different cohort");
  }
  const declined = await tx.match.findFirst({
    where: { openingId: opening.id, graduateId: app.graduateId, status: "COMPANY_REJECTED" },
    select: { id: true },
  });
  if (declined) throw errors.conflict("This company has already declined this graduate for this opening");

  const score = scoreMatch(toCandidate(app.graduate), opening);
  if (!score.eligible) throw errors.badRequest(score.ineligibleReason ?? "Graduate is not eligible");

  const match = await tx.match.create({
    data: {
      graduateId: app.graduateId,
      applicationId: app.id,
      openingId: opening.id,
      score: score.total,
      scoreBreakdown: JSON.parse(JSON.stringify(score.breakdown)),
      source: input.source,
      proposedById: input.actor.userId,
    },
  });
  const change = await transitionApplication(tx, {
    applicationId: app.id,
    to: "MATCHED",
    actor: "SYSTEM",
    auditActor: input.actor,
  });
  await recordAudit(tx, {
    actor: input.actor,
    action: "match.proposed",
    entityType: "Match",
    entityId: match.id,
    after: { status: "PROPOSED", openingId: opening.id, score: score.total, source: input.source },
  });

  const owners = await tx.companyMember.findMany({
    where: { companyId: opening.companyId, role: "OWNER" },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  for (const o of owners) {
    await createNotification(tx, {
      userId: o.user.id,
      type: "match.proposed",
      title: "New candidate to review",
      body: `A graduate has been matched to ${opening.title}.`,
      data: { matchId: match.id, openingId: opening.id },
    });
  }
  return { match, change, owners: owners.map((o) => o.user), opening };
}

export async function proposeMatch(actor: AuditActor, openingId: string, applicationId: string) {
  const result = await db.$transaction((tx) =>
    createMatch(tx, { openingId, applicationId, source: "ADMIN", actor }),
  );
  await sendApplicationEmail(result.change);
  for (const owner of result.owners) {
    await sendEmail({
      template: "match-proposed",
      to: owner.email,
      toUserId: owner.id,
      idempotencyKey: `match-proposed:${result.match.id}:${owner.id}`,
      props: {
        firstName: firstNameOf(owner.name),
        companyName: result.opening.company.name,
        openingTitle: result.opening.title,
        reviewUrl: `${env().APP_URL}/company/matches/${result.match.id}`,
      },
    });
  }
  return result.match;
}

/** Ends a PROPOSED match without a company decision and returns the graduate to the pool. */
async function closeProposedMatch(
  tx: Tx,
  matchId: string,
  to: "WITHDRAWN" | "COMPANY_REJECTED",
  actor: AuditActor,
  reason: string,
): Promise<ApplicationChange> {
  const match = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
  matchMachine.assert(match.status, to, to === "WITHDRAWN" ? "ADMIN" : "COMPANY");
  const { count } = await tx.match.updateMany({
    where: { id: matchId, status: "PROPOSED" },
    data: { status: to, decidedById: actor.userId, decidedAt: new Date(), decisionReason: reason },
  });
  if (count === 0) throw errors.conflict("This match was changed by someone else. Refresh and try again.");
  await recordAudit(tx, {
    actor,
    action: to === "WITHDRAWN" ? "match.withdrawn" : "match.rejected",
    entityType: "Match",
    entityId: matchId,
    before: { status: "PROPOSED" },
    after: { status: to },
  });
  return transitionApplication(tx, {
    applicationId: match.applicationId,
    to: "QUALIFIED",
    actor: "SYSTEM",
    auditActor: actor,
  });
}

export async function withdrawMatch(actor: AuditActor, matchId: string, reason: string) {
  const change = await db.$transaction(async (tx) => {
    const exists = await tx.match.findUnique({ where: { id: matchId }, select: { id: true } });
    if (!exists) throw errors.notFound("Match");
    return closeProposedMatch(tx, matchId, "WITHDRAWN", actor, reason);
  });
  await sendApplicationEmail(change);
  return { id: matchId, status: "WITHDRAWN" as const };
}

// ─── Company: review and decide ───────────────────────────────────────────────

const matchSummarySelect = {
  id: true,
  status: true,
  score: true,
  scoreBreakdown: true,
  createdAt: true,
  decidedAt: true,
  decisionReason: true,
  opening: { select: { id: true, title: true } },
  graduate: { select: limitedGraduateSelect },
} as const;

export async function listCompanyMatches(ctx: CompanyContext, query: z.infer<typeof matchListQuery>) {
  const rows = await db.match.findMany({
    where: {
      opening: { companyId: ctx.companyId },
      ...(query.status ? { status: query.status } : {}),
      ...(query.openingId ? { openingId: query.openingId } : {}),
    },
    select: matchSummarySelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...cursorArgs(query),
  });
  const page = toPage(rows, query.limit);
  return { ...page, items: page.items.map((m) => ({ ...m, graduate: presentLimited(m.graduate) })) };
}

async function findCompanyMatch(ctx: CompanyContext, matchId: string) {
  const match = await db.match.findFirst({
    where: { id: matchId, opening: { companyId: ctx.companyId } },
    select: {
      ...matchSummarySelect,
      graduate: {
        select: {
          ...limitedGraduateSelect,
          phone: true,
          cvPublicId: true,
          user: { select: { email: true } },
        },
      },
    },
  });
  if (!match) throw errors.notFound("Match");
  return match;
}

/** Contact details and the CV are only revealed once the company has accepted. */
export async function getCompanyMatch(ctx: CompanyContext, matchId: string) {
  const match = await findCompanyMatch(ctx, matchId);
  const { phone, cvPublicId, user, ...graduate } = match.graduate;
  const accepted = match.status === "COMPANY_ACCEPTED";
  return {
    ...match,
    graduate: {
      ...presentLimited(graduate),
      ...(accepted ? { phone, email: user.email, hasCv: Boolean(cvPublicId) } : {}),
    },
  };
}

export async function getMatchCvForCompany(ctx: CompanyContext, matchId: string) {
  const match = await findCompanyMatch(ctx, matchId);
  if (match.status !== "COMPANY_ACCEPTED")
    throw errors.forbidden("The CV is shared once you accept the match");
  const link = await getCvDownloadUrl(match.graduate.id);
  await recordAudit(db, {
    actor: toAuditActor(ctx.user),
    action: "graduate.cv_accessed",
    entityType: "GraduateProfile",
    entityId: match.graduate.id,
    metadata: { matchId },
  });
  return link;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/** Accepting creates the placement (3 months by default) in the same transaction. */
export async function acceptMatch(
  ctx: CompanyContext,
  matchId: string,
  input: z.infer<typeof acceptMatchSchema>,
) {
  const actor = toAuditActor(ctx.user);
  const result = await db.$transaction(async (tx) => {
    const match = await tx.match.findFirst({
      where: { id: matchId, opening: { companyId: ctx.companyId } },
      include: {
        opening: { include: { cohort: { select: { internshipStartsAt: true } } } },
        graduate: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });
    if (!match) throw errors.notFound("Match");
    matchMachine.assert(match.status, "COMPANY_ACCEPTED", "COMPANY");

    await tx.$queryRaw`SELECT "id" FROM "InternshipOpening" WHERE "id" = ${match.openingId} FOR UPDATE`;
    const opening = await loadOpeningForMatching(tx, match.openingId);
    if (opening.company.verificationStatus !== "VERIFIED") {
      throw errors.forbidden("Your company must be verified to accept interns");
    }
    if (opening._count.placements >= opening.slots)
      throw errors.conflict("All slots for this opening are filled");

    const supervisorId = input.supervisorId ?? ctx.memberId;
    const supervisor = await tx.companyMember.findFirst({
      where: { id: supervisorId, companyId: ctx.companyId },
      select: { id: true, user: { select: { id: true, name: true, email: true } } },
    });
    if (!supervisor) throw errors.badRequest("The supervisor must be a member of your company");

    const cohortStart = match.opening.cohort?.internshipStartsAt;
    const startDate =
      input.startDate ?? (cohortStart && cohortStart > new Date() ? cohortStart : startOfToday());
    if (startDate < startOfToday()) throw errors.badRequest("The start date cannot be in the past");

    const { count } = await tx.match.updateMany({
      where: { id: matchId, status: "PROPOSED" },
      data: { status: "COMPANY_ACCEPTED", decidedById: ctx.user.id, decidedAt: new Date() },
    });
    if (count === 0) throw errors.conflict("This match was changed by someone else. Refresh and try again.");

    const placement = await tx.placement.create({
      data: {
        matchId,
        applicationId: match.applicationId,
        graduateId: match.graduateId,
        openingId: match.openingId,
        companyId: ctx.companyId,
        supervisorId: supervisor.id,
        startDate,
        endDate: addMonths(startDate, 3),
      },
    });
    const changes = [
      await transitionApplication(tx, {
        applicationId: match.applicationId,
        to: "PLACED",
        actor: "SYSTEM",
        auditActor: actor,
      }),
    ];
    await recordAudit(tx, {
      actor,
      action: "match.accepted",
      entityType: "Match",
      entityId: matchId,
      before: { status: "PROPOSED" },
      after: { status: "COMPANY_ACCEPTED" },
    });
    await recordAudit(tx, {
      actor,
      action: "placement.created",
      entityType: "Placement",
      entityId: placement.id,
      after: {
        status: "ACTIVE",
        startDate: startDate.toISOString(),
        endDate: placement.endDate.toISOString(),
      },
    });

    // Last slot filled: close the opening and release everyone else proposed to it.
    if (opening._count.placements + 1 >= opening.slots) {
      await tx.internshipOpening.update({ where: { id: opening.id }, data: { status: "CLOSED" } });
      await recordAudit(tx, {
        actor: null,
        action: "opening.status_changed",
        entityType: "InternshipOpening",
        entityId: opening.id,
        before: { status: "OPEN" },
        after: { status: "CLOSED" },
        metadata: { reason: "all slots filled" },
      });
      const others = await tx.match.findMany({
        where: { openingId: opening.id, status: "PROPOSED" },
        select: { id: true },
      });
      for (const o of others) {
        changes.push(
          await closeProposedMatch(tx, o.id, "WITHDRAWN", actor, "All slots for this opening were filled"),
        );
      }
    }
    return { match, opening, placement, supervisor, changes };
  });

  const { match, opening, placement, supervisor } = result;
  for (const change of result.changes) await sendApplicationEmail(change);
  await sendEmail({
    template: "match-accepted",
    to: match.graduate.user.email,
    toUserId: match.graduate.user.id,
    idempotencyKey: `match-accepted:${matchId}`,
    props: {
      firstName: match.graduate.firstName,
      companyName: opening.company.name,
      openingTitle: opening.title,
      companyAddress: match.opening.location ?? `${opening.state} State`,
      workMode: opening.workMode,
      startDate: fmt(placement.startDate),
      endDate: fmt(placement.endDate),
      dashboardUrl: `${env().APP_URL}/dashboard/placement`,
    },
  });
  await sendEmail({
    template: "placement-started",
    to: supervisor.user.email,
    toUserId: supervisor.user.id,
    idempotencyKey: `placement-started:${placement.id}`,
    props: {
      firstName: firstNameOf(supervisor.user.name),
      internName: `${match.graduate.firstName} ${match.graduate.lastName}`,
      internEmail: match.graduate.user.email,
      internPhone: match.graduate.phone ?? "not provided",
      openingTitle: opening.title,
      startDate: fmt(placement.startDate),
      endDate: fmt(placement.endDate),
      dashboardUrl: `${env().APP_URL}/company/interns/${placement.id}`,
    },
  });
  return placement;
}

export async function rejectMatch(ctx: CompanyContext, matchId: string, reason: string) {
  const change = await db.$transaction(async (tx) => {
    const match = await tx.match.findFirst({
      where: { id: matchId, opening: { companyId: ctx.companyId } },
      select: { id: true },
    });
    if (!match) throw errors.notFound("Match");
    return closeProposedMatch(tx, matchId, "COMPANY_REJECTED", toAuditActor(ctx.user), reason);
  });
  await sendApplicationEmail(change);
  return { id: matchId, status: "COMPANY_REJECTED" as const };
}
