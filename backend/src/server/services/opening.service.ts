import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { OpeningStatus } from "@/generated/prisma/enums";
import { toAuditActor, type CompanyContext } from "@/server/auth/session";
import { db, type Tx } from "@/server/db";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { AppError, errors } from "@/server/lib/errors";
import { normaliseOpeningPlace, openingPlaceProblems } from "@/server/validators/company";
import { cursorArgs, toPage } from "@/server/lib/pagination";
import { openingMachine, type Actor } from "@/server/lib/state-machine";
import type {
  CreateOpeningInput,
  UpdateOpeningInput,
  adminOpeningListQuery,
  openingListQuery,
} from "@/server/validators/company";

const openingSelect = {
  id: true,
  companyId: true,
  cohortId: true,
  title: true,
  department: true,
  description: true,
  slots: true,
  preferredDisciplines: true,
  country: true,
  city: true,
  state: true,
  location: true,
  durationWeeks: true,
  startDate: true,
  mayLeadToFullTime: true,
  workMode: true,
  schedule: true,
  openToNysc: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  skills: { select: { required: true, minLevel: true, skill: { select: { id: true, name: true } } } },
  _count: { select: { matches: true, placements: true } },
} as const;

async function assertReferences(tx: Tx, input: UpdateOpeningInput) {
  if (input.skills) {
    const ids = input.skills.map((s) => s.skillId);
    const found = await tx.skill.count({ where: { id: { in: ids }, isActive: true } });
    if (found !== ids.length) throw errors.badRequest("One or more skills are not available");
  }
  if (input.cohortId) {
    const cohort = await tx.cohort.findUnique({ where: { id: input.cohortId }, select: { id: true } });
    if (!cohort) throw errors.notFound("Cohort");
  }
}

const skillRows = (skills: NonNullable<UpdateOpeningInput["skills"]>) =>
  skills.map((s) => ({ skillId: s.skillId, minLevel: s.minLevel ?? null, required: s.required }));

// ─── Company ──────────────────────────────────────────────────────────────────

export async function listMyOpenings(ctx: CompanyContext, query: z.infer<typeof openingListQuery>) {
  const rows = await db.internshipOpening.findMany({
    where: { companyId: ctx.companyId, ...(query.status ? { status: query.status } : {}) },
    select: openingSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...cursorArgs(query),
  });
  return toPage(rows, query.limit);
}

export async function getMyOpening(ctx: CompanyContext, openingId: string) {
  // Scoped by company: another company's opening looks like "not found".
  const opening = await db.internshipOpening.findFirst({
    where: { id: openingId, companyId: ctx.companyId },
    select: openingSelect,
  });
  if (!opening) throw errors.notFound("Opening");
  return opening;
}

export async function createOpening(ctx: CompanyContext, input: CreateOpeningInput) {
  const { skills, ...fields } = input;
  return db.$transaction(async (tx) => {
    await assertReferences(tx, input);
    const opening = await tx.internshipOpening.create({
      data: {
        ...fields,
        startDate: new Date(fields.startDate),
        companyId: ctx.companyId,
        createdById: ctx.user.id,
        status: "DRAFT",
        skills: { create: skillRows(skills) },
      },
      select: openingSelect,
    });
    await recordAudit(tx, {
      actor: toAuditActor(ctx.user),
      action: "opening.created",
      entityType: "InternshipOpening",
      entityId: opening.id,
      after: { title: opening.title, slots: opening.slots },
    });
    return opening;
  });
}

export async function updateOpening(ctx: CompanyContext, openingId: string, input: UpdateOpeningInput) {
  const { skills, ...fields } = input;
  return db.$transaction(async (tx) => {
    const current = await tx.internshipOpening.findFirst({
      where: { id: openingId, companyId: ctx.companyId },
    });
    if (!current) throw errors.notFound("Opening");
    // Check where the role is against the opening as it will be after this change.
    const place = normaliseOpeningPlace({ ...current, ...fields });
    const problems = openingPlaceProblems(place);
    if (problems.length) throw new AppError("VALIDATION_ERROR", problems[0].message, problems);
    await assertReferences(tx, input);
    if (skills) await tx.openingSkill.deleteMany({ where: { openingId } });
    const opening = await tx.internshipOpening.update({
      where: { id: openingId },
      data: {
        ...fields,
        ...(fields.startDate ? { startDate: new Date(fields.startDate) } : {}),
        country: place.country,
        city: place.city,
        state: place.state,
        ...(skills ? { skills: { create: skillRows(skills) } } : {}),
      },
      select: openingSelect,
    });
    await recordAudit(tx, {
      actor: toAuditActor(ctx.user),
      action: "opening.updated",
      entityType: "InternshipOpening",
      entityId: openingId,
      metadata: { fields: Object.keys(input) },
    });
    return opening;
  });
}

async function moveOpening(
  actor: Actor,
  auditActor: AuditActor,
  openingId: string,
  to: OpeningStatus,
  companyId?: string,
) {
  return db.$transaction(async (tx) => {
    const current = await tx.internshipOpening.findFirst({
      where: { id: openingId, ...(companyId ? { companyId } : {}) },
      include: { company: { select: { verificationStatus: true } } },
    });
    if (!current) throw errors.notFound("Opening");
    openingMachine.assert(current.status, to, actor);
    if (to === "OPEN" && current.company.verificationStatus !== "VERIFIED") {
      throw errors.forbidden("Your company must be verified before openings can be published");
    }
    const { count } = await tx.internshipOpening.updateMany({
      where: { id: openingId, status: current.status },
      data: { status: to },
    });
    if (count === 0)
      throw errors.conflict("This opening was changed by someone else. Refresh and try again.");
    await recordAudit(tx, {
      actor: auditActor,
      action: "opening.status_changed",
      entityType: "InternshipOpening",
      entityId: openingId,
      before: { status: current.status },
      after: { status: to },
    });
    return tx.internshipOpening.findUniqueOrThrow({ where: { id: openingId }, select: openingSelect });
  });
}

/** Publish (OPEN) or close an opening. */
export function changeMyOpeningStatus(ctx: CompanyContext, openingId: string, to: OpeningStatus) {
  return moveOpening("COMPANY", toAuditActor(ctx.user), openingId, to, ctx.companyId);
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listOpeningsForAdmin(query: z.infer<typeof adminOpeningListQuery>) {
  const where: Prisma.InternshipOpeningWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.cohortId ? { cohortId: query.cohortId } : {}),
    ...(query.country ? { country: query.country } : {}),
    ...(query.state ? { state: query.state } : {}),
  };
  const rows = await db.internshipOpening.findMany({
    where,
    select: { ...openingSelect, company: { select: { id: true, name: true, verificationStatus: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...cursorArgs(query),
  });
  return toPage(rows, query.limit);
}

export function changeOpeningStatusAsAdmin(actor: AuditActor, openingId: string, to: OpeningStatus) {
  return moveOpening("ADMIN", actor, openingId, to);
}
