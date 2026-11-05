import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { toAuditActor, type CompanyContext } from "@/server/auth/session";
import { db } from "@/server/db";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import { cursorArgs, toPage } from "@/server/lib/pagination";
import { placementMachine } from "@/server/lib/state-machine";
import type { placementListQuery } from "@/server/validators/matching";
import { sendApplicationEmail, transitionApplication } from "./application.service";
import { createNotification } from "./notification.service";

type ListQuery = z.infer<typeof placementListQuery>;

const placementSelect = {
  id: true,
  status: true,
  startDate: true,
  endDate: true,
  endedAt: true,
  endReason: true,
  offeredPermanentRole: true,
  permanentOfferDate: true,
  createdAt: true,
  opening: { select: { id: true, title: true, workMode: true, state: true, location: true } },
  company: { select: { id: true, name: true } },
  supervisor: { select: { id: true, jobTitle: true, user: { select: { name: true, email: true } } } },
  graduate: { select: { id: true, firstName: true, lastName: true } },
} as const;

/** After acceptance the company has the intern's contact details. */
const internSelect = {
  ...placementSelect,
  graduate: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      institution: true,
      courseOfStudy: true,
      photoUrl: true,
      user: { select: { email: true } },
    },
  },
} as const;

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listPlacementsForAdmin(query: ListQuery) {
  const where: Prisma.PlacementWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.cohortId ? { application: { cohortId: query.cohortId } } : {}),
  };
  const rows = await db.placement.findMany({
    where,
    select: placementSelect,
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    ...cursorArgs(query),
  });
  return toPage(rows, query.limit);
}

export async function getPlacementForAdmin(placementId: string) {
  const placement = await db.placement.findUnique({
    where: { id: placementId },
    select: {
      ...internSelect,
      match: { select: { id: true, score: true, scoreBreakdown: true } },
      application: { select: { id: true, status: true, cohort: { select: { id: true, name: true } } } },
      checkIns: { orderBy: [{ month: "asc" }, { authorType: "asc" }] },
      evaluation: true,
      programmeEvaluation: true,
    },
  });
  if (!placement) throw errors.notFound("Placement");
  return placement;
}

async function endPlacement(
  actor: AuditActor,
  placementId: string,
  to: "COMPLETED" | "TERMINATED",
  reason: string | null,
) {
  const result = await db.$transaction(async (tx) => {
    const current = await tx.placement.findUnique({
      where: { id: placementId },
      select: { status: true, applicationId: true, graduate: { select: { userId: true } } },
    });
    if (!current) throw errors.notFound("Placement");
    placementMachine.assert(current.status, to, "ADMIN");
    const { count } = await tx.placement.updateMany({
      where: { id: placementId, status: current.status },
      data: { status: to, endedAt: new Date(), endReason: reason },
    });
    if (count === 0)
      throw errors.conflict("This placement was changed by someone else. Refresh and try again.");
    await recordAudit(tx, {
      actor,
      action: "placement.status_changed",
      entityType: "Placement",
      entityId: placementId,
      before: { status: current.status },
      after: { status: to },
    });
    if (to === "COMPLETED") {
      return transitionApplication(tx, {
        applicationId: current.applicationId,
        to: "COMPLETED",
        actor: "SYSTEM",
        auditActor: actor,
      });
    }
    await createNotification(tx, {
      userId: current.graduate.userId,
      type: "placement.terminated",
      title: "Internship ended",
      body: "Your internship placement has been ended early. Contact SIIP if you have questions.",
      data: { placementId },
    });
    return null;
  });
  if (result) await sendApplicationEmail(result);
  return getPlacementForAdmin(placementId);
}

export function completePlacement(actor: AuditActor, placementId: string) {
  return endPlacement(actor, placementId, "COMPLETED", null);
}

export function terminatePlacement(actor: AuditActor, placementId: string, reason: string) {
  return endPlacement(actor, placementId, "TERMINATED", reason);
}

// ─── Company ──────────────────────────────────────────────────────────────────

export async function listMyInterns(ctx: CompanyContext, query: ListQuery) {
  const rows = await db.placement.findMany({
    where: { companyId: ctx.companyId, ...(query.status ? { status: query.status } : {}) },
    select: internSelect,
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    ...cursorArgs(query),
  });
  return toPage(rows, query.limit);
}

export async function getMyIntern(ctx: CompanyContext, placementId: string) {
  const placement = await db.placement.findFirst({
    where: { id: placementId, companyId: ctx.companyId },
    select: internSelect,
  });
  if (!placement) throw errors.notFound("Intern");
  return placement;
}

export async function assignSupervisor(ctx: CompanyContext, placementId: string, supervisorId: string) {
  await db.$transaction(async (tx) => {
    const [placement, member] = await Promise.all([
      tx.placement.findFirst({
        where: { id: placementId, companyId: ctx.companyId },
        select: { supervisorId: true },
      }),
      tx.companyMember.findFirst({
        where: { id: supervisorId, companyId: ctx.companyId },
        select: { id: true },
      }),
    ]);
    if (!placement) throw errors.notFound("Intern");
    if (!member) throw errors.badRequest("The supervisor must be a member of your company");
    await tx.placement.update({ where: { id: placementId }, data: { supervisorId } });
    await recordAudit(tx, {
      actor: toAuditActor(ctx.user),
      action: "placement.supervisor_assigned",
      entityType: "Placement",
      entityId: placementId,
      before: { supervisorId: placement.supervisorId },
      after: { supervisorId },
    });
  });
  return getMyIntern(ctx, placementId);
}

// ─── Graduate ─────────────────────────────────────────────────────────────────

/** The graduate's latest match and, once accepted, their placement with company details. */
export async function getMyPlacement(graduateId: string) {
  const [match, placement] = await Promise.all([
    db.match.findFirst({
      where: { graduateId, status: { in: ["PROPOSED", "COMPANY_ACCEPTED"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        opening: { select: { title: true, company: { select: { name: true } } } },
      },
    }),
    db.placement.findFirst({
      where: { graduateId },
      orderBy: { createdAt: "desc" },
      select: {
        ...placementSelect,
        company: {
          select: {
            id: true,
            name: true,
            address: true,
            state: true,
            website: true,
            logoUrl: true,
            industry: true,
          },
        },
      },
    }),
  ]);
  return { match, placement };
}
