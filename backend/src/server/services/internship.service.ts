import type { CheckInAuthor } from "@/generated/prisma/enums";
import { toAuditActor, type CompanyContext } from "@/server/auth/session";
import { db } from "@/server/db";
import { recordAudit } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import type { CheckInInput, EvaluationInput } from "@/server/validators/internship";
import { createNotification } from "./notification.service";

const DAY = 24 * 60 * 60 * 1000;
/** The company can evaluate from two weeks before the end date. */
const EVALUATION_WINDOW_DAYS = 14;

/** 1-based month of the internship today (0 before it starts), capped at 3. */
export function internshipMonth(startDate: Date, now = new Date()) {
  if (now < startDate) return 0;
  const months =
    (now.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + now.getUTCMonth() - startDate.getUTCMonth();
  const reachedDay = now.getUTCDate() >= startDate.getUTCDate() ? 0 : -1;
  return Math.min(3, months + reachedDay + 1);
}

function assertCheckInAllowed(placement: { status: string; startDate: Date }, month: number) {
  if (placement.status !== "ACTIVE") throw errors.conflict("Check-ins are only for active internships");
  const current = internshipMonth(placement.startDate);
  if (month > current) {
    throw errors.badRequest(
      current === 0
        ? "The internship has not started yet"
        : `You can submit check-ins up to month ${current}`,
    );
  }
}

async function createCheckIn(
  placementId: string,
  authorType: CheckInAuthor,
  authorUserId: string,
  input: CheckInInput,
) {
  const existing = await db.checkIn.findUnique({
    where: { placementId_authorType_month: { placementId, authorType, month: input.month } },
    select: { id: true },
  });
  if (existing) throw errors.conflict(`The month ${input.month} check-in has already been submitted`);
  return db.checkIn.create({ data: { placementId, authorType, authorUserId, ...input } });
}

const checkInSelect = {
  id: true,
  authorType: true,
  month: true,
  progressNote: true,
  challenges: true,
  rating: true,
  createdAt: true,
} as const;

// ─── Graduate ─────────────────────────────────────────────────────────────────

async function findMyActivePlacement(graduateId: string) {
  const placement = await db.placement.findFirst({
    where: { graduateId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, startDate: true },
  });
  if (!placement) throw errors.notFound("Placement");
  return placement;
}

/** The intern sees their own check-ins only, not the supervisor's notes. */
export async function listMyCheckIns(graduateId: string) {
  const placement = await findMyActivePlacement(graduateId);
  return db.checkIn.findMany({
    where: { placementId: placement.id, authorType: "INTERN" },
    select: checkInSelect,
    orderBy: { month: "asc" },
  });
}

export async function submitInternCheckIn(userId: string, graduateId: string, input: CheckInInput) {
  const placement = await findMyActivePlacement(graduateId);
  assertCheckInAllowed(placement, input.month);
  return createCheckIn(placement.id, "INTERN", userId, input);
}

// ─── Company ──────────────────────────────────────────────────────────────────

/** The owner, or the supervisor assigned to this intern. */
async function findSupervisedPlacement(ctx: CompanyContext, placementId: string) {
  const placement = await db.placement.findFirst({
    where: { id: placementId, companyId: ctx.companyId },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      supervisorId: true,
      graduate: { select: { userId: true } },
    },
  });
  if (!placement) throw errors.notFound("Intern");
  if (ctx.memberRole !== "OWNER" && placement.supervisorId !== ctx.memberId) {
    throw errors.forbidden("Only this intern's supervisor or the company owner can do this");
  }
  return placement;
}

export async function listInternCheckIns(ctx: CompanyContext, placementId: string) {
  const placement = await db.placement.findFirst({
    where: { id: placementId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!placement) throw errors.notFound("Intern");
  return db.checkIn.findMany({
    where: { placementId },
    select: checkInSelect,
    orderBy: [{ month: "asc" }, { authorType: "asc" }],
  });
}

export async function submitSupervisorCheckIn(ctx: CompanyContext, placementId: string, input: CheckInInput) {
  const placement = await findSupervisedPlacement(ctx, placementId);
  assertCheckInAllowed(placement, input.month);
  return createCheckIn(placement.id, "SUPERVISOR", ctx.user.id, input);
}

export async function submitEvaluation(ctx: CompanyContext, placementId: string, input: EvaluationInput) {
  const placement = await findSupervisedPlacement(ctx, placementId);
  const windowOpens = new Date(placement.endDate.getTime() - EVALUATION_WINDOW_DAYS * DAY);
  const open =
    placement.status === "COMPLETED" || (placement.status === "ACTIVE" && new Date() >= windowOpens);
  if (!open) {
    throw errors.badRequest(
      placement.status === "TERMINATED"
        ? "This internship was ended early"
        : `Evaluations open on ${windowOpens.toISOString().slice(0, 10)}`,
    );
  }
  const areas = [input.punctuality, input.skill, input.communication, input.teamwork, input.initiative];
  const overallScore = Math.round((areas.reduce((a, b) => a + b, 0) / areas.length) * 100) / 100;

  return db.$transaction(async (tx) => {
    const existing = await tx.evaluation.findUnique({ where: { placementId }, select: { id: true } });
    if (existing) throw errors.conflict("This intern has already been evaluated");
    const evaluation = await tx.evaluation.create({
      data: { placementId, submittedById: ctx.user.id, overallScore, ...input },
    });
    await recordAudit(tx, {
      actor: toAuditActor(ctx.user),
      action: "evaluation.submitted",
      entityType: "Placement",
      entityId: placementId,
      after: { overallScore, wouldHire: input.wouldHire },
    });
    return evaluation;
  });
}

export async function recordPermanentOffer(
  ctx: CompanyContext,
  placementId: string,
  input: { offeredAt?: Date; notes?: string },
) {
  return db.$transaction(async (tx) => {
    const placement = await tx.placement.findFirst({
      where: { id: placementId, companyId: ctx.companyId },
      select: { status: true, offeredPermanentRole: true, graduate: { select: { userId: true } } },
    });
    if (!placement) throw errors.notFound("Intern");
    if (placement.status === "TERMINATED") throw errors.conflict("This internship was ended early");
    if (placement.offeredPermanentRole) throw errors.conflict("A permanent offer is already recorded");
    const offerDate = input.offeredAt ?? new Date();
    const updated = await tx.placement.update({
      where: { id: placementId },
      data: {
        offeredPermanentRole: true,
        permanentOfferDate: offerDate,
        permanentOfferNotes: input.notes ?? null,
      },
      select: { id: true, offeredPermanentRole: true, permanentOfferDate: true, permanentOfferNotes: true },
    });
    await recordAudit(tx, {
      actor: toAuditActor(ctx.user),
      action: "placement.permanent_offer_recorded",
      entityType: "Placement",
      entityId: placementId,
      after: { offeredPermanentRole: true, permanentOfferDate: offerDate.toISOString() },
    });
    await createNotification(tx, {
      userId: placement.graduate.userId,
      type: "placement.permanent_offer",
      title: "Permanent job offer",
      body: "Your host company has recorded a permanent job offer for you. Congratulations!",
      data: { placementId },
    });
    return updated;
  });
}
