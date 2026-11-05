import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { CompanyVerificationStatus } from "@/generated/prisma/enums";
import type { CompanyContext, CurrentUser } from "@/server/auth/session";
import { toAuditActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { env } from "@/server/env";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import { cursorArgs, toPage } from "@/server/lib/pagination";
import { companyMachine } from "@/server/lib/state-machine";
import { UPLOAD_KINDS, confirmUpload, createSignedUpload, deleteAsset } from "@/server/storage/cloudinary";
import type {
  RegisterCompanyInput,
  UpdateCompanyInput,
  adminCompanyListQuery,
} from "@/server/validators/company";
import type { z } from "zod";
import { createNotification } from "./notification.service";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || "there";

const companySelect = {
  id: true,
  name: true,
  rcNumber: true,
  industry: true,
  description: true,
  address: true,
  state: true,
  website: true,
  logoUrl: true,
  verificationStatus: true,
  verifiedAt: true,
  statusReason: true,
  createdAt: true,
} as const;

// ─── Registration and profile ─────────────────────────────────────────────────

/** A company account registers its company and becomes its OWNER. */
export async function registerCompany(user: CurrentUser, input: RegisterCompanyInput) {
  const existing = await db.companyMember.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (existing) throw errors.conflict("You already belong to a company");
  const { jobTitle, ...company } = input;
  return db.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        ...company,
        description: company.description ?? null,
        website: company.website ?? null,
        members: { create: { userId: user.id, role: "OWNER", jobTitle: jobTitle ?? null } },
      },
      select: companySelect,
    });
    await recordAudit(tx, {
      actor: toAuditActor(user),
      action: "company.registered",
      entityType: "Company",
      entityId: created.id,
      after: { verificationStatus: created.verificationStatus },
    });
    return created;
  });
}

export async function getMyCompany(ctx: CompanyContext) {
  const company = await db.company.findUniqueOrThrow({ where: { id: ctx.companyId }, select: companySelect });
  return { ...company, myRole: ctx.memberRole };
}

/** Name and RC number are what we verified, so they are locked once verified. */
export async function updateMyCompany(ctx: CompanyContext, input: UpdateCompanyInput) {
  return db.$transaction(async (tx) => {
    const current = await tx.company.findUniqueOrThrow({ where: { id: ctx.companyId } });
    const identityChanged =
      (input.name !== undefined && input.name !== current.name) ||
      (input.rcNumber !== undefined && input.rcNumber !== current.rcNumber);
    if (identityChanged && ["VERIFIED", "SUSPENDED"].includes(current.verificationStatus)) {
      throw errors.conflict("Contact SIIP to change the name or RC number of a verified company");
    }
    const updated = await tx.company.update({
      where: { id: ctx.companyId },
      data: input,
      select: companySelect,
    });
    await recordAudit(tx, {
      actor: toAuditActor(ctx.user),
      action: "company.updated",
      entityType: "Company",
      entityId: ctx.companyId,
      metadata: { fields: Object.keys(input) },
    });
    return updated;
  });
}

/** A rejected company fixes its details and asks to be reviewed again. */
export async function resubmitCompany(ctx: CompanyContext) {
  return db.$transaction(async (tx) => {
    const current = await tx.company.findUniqueOrThrow({ where: { id: ctx.companyId } });
    companyMachine.assert(current.verificationStatus, "PENDING", "COMPANY");
    await tx.company.update({
      where: { id: ctx.companyId },
      data: { verificationStatus: "PENDING", statusReason: null },
    });
    await recordAudit(tx, {
      actor: toAuditActor(ctx.user),
      action: "company.status_changed",
      entityType: "Company",
      entityId: ctx.companyId,
      before: { verificationStatus: current.verificationStatus },
      after: { verificationStatus: "PENDING" },
    });
    return tx.company.findUniqueOrThrow({ where: { id: ctx.companyId }, select: companySelect });
  });
}

export function signLogoUpload(ctx: CompanyContext) {
  return createSignedUpload("logo", ctx.companyId);
}

export async function confirmLogo(ctx: CompanyContext, publicId: string) {
  const upload = await confirmUpload("logo", ctx.companyId, publicId);
  const previous = await db.company.findUniqueOrThrow({
    where: { id: ctx.companyId },
    select: { logoPublicId: true },
  });
  const updated = await db.company.update({
    where: { id: ctx.companyId },
    data: { logoPublicId: upload.publicId, logoUrl: upload.url },
    select: companySelect,
  });
  if (previous.logoPublicId && previous.logoPublicId !== upload.publicId) {
    await deleteAsset(previous.logoPublicId, UPLOAD_KINDS.logo.resourceType, UPLOAD_KINDS.logo.deliveryType);
  }
  return updated;
}

// ─── Members and invitations ──────────────────────────────────────────────────

export function listMembers(ctx: CompanyContext) {
  return db.companyMember.findMany({
    where: { companyId: ctx.companyId },
    select: {
      id: true,
      role: true,
      jobTitle: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      _count: { select: { supervisedPlacements: true } },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

export async function removeMember(ctx: CompanyContext, memberId: string) {
  await db.$transaction(async (tx) => {
    const member = await tx.companyMember.findFirst({ where: { id: memberId, companyId: ctx.companyId } });
    if (!member) throw errors.notFound("Member");
    if (member.role === "OWNER") throw errors.conflict("The company owner cannot be removed");
    await tx.companyMember.delete({ where: { id: memberId } });
    await recordAudit(tx, {
      actor: toAuditActor(ctx.user),
      action: "company.member_removed",
      entityType: "Company",
      entityId: ctx.companyId,
      metadata: { memberId },
    });
  });
  return { id: memberId, removed: true };
}

export function listInvitations(ctx: CompanyContext) {
  return db.companyInvitation.findMany({
    where: { companyId: ctx.companyId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Emails a single-use link; only its hash is stored. */
export async function inviteSupervisor(ctx: CompanyContext, email: string) {
  const token = randomBytes(32).toString("base64url");
  const { invitation, companyName } = await db.$transaction(async (tx) => {
    const existingMember = await tx.companyMember.findFirst({
      where: { companyId: ctx.companyId, user: { email } },
      select: { id: true },
    });
    if (existingMember) throw errors.conflict("This person is already a member of your company");
    // A new invitation replaces any pending one for the same email.
    await tx.companyInvitation.updateMany({
      where: { companyId: ctx.companyId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const invitation = await tx.companyInvitation.create({
      data: {
        companyId: ctx.companyId,
        email,
        role: "SUPERVISOR",
        tokenHash: hashToken(token),
        invitedById: ctx.user.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
    await recordAudit(tx, {
      actor: toAuditActor(ctx.user),
      action: "company.supervisor_invited",
      entityType: "Company",
      entityId: ctx.companyId,
      metadata: { invitationId: invitation.id },
    });
    const company = await tx.company.findUniqueOrThrow({
      where: { id: ctx.companyId },
      select: { name: true },
    });
    return { invitation, companyName: company.name };
  });

  await sendEmail({
    template: "supervisor-invitation",
    to: email,
    idempotencyKey: `supervisor-invitation:${invitation.id}`,
    props: {
      companyName,
      inviterName: ctx.user.name,
      acceptUrl: `${env().APP_URL}/company/join?token=${encodeURIComponent(token)}`,
    },
  });
  return invitation;
}

export async function revokeInvitation(ctx: CompanyContext, invitationId: string) {
  const { count } = await db.companyInvitation.updateMany({
    where: { id: invitationId, companyId: ctx.companyId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw errors.notFound("Invitation");
  return { id: invitationId, revoked: true };
}

/** The invitee signs up as a company user with the invited email, then accepts. */
export async function acceptInvitation(user: CurrentUser, token: string) {
  return db.$transaction(async (tx) => {
    const invitation = await tx.companyInvitation.findUnique({ where: { tokenHash: hashToken(token) } });
    const usable =
      invitation && !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > new Date();
    if (!usable) throw errors.badRequest("This invitation is invalid or has expired");
    if (invitation.email !== user.email.toLowerCase()) {
      throw errors.forbidden("This invitation was sent to a different email address");
    }
    const existing = await tx.companyMember.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (existing) throw errors.conflict("You already belong to a company");

    const member = await tx.companyMember.create({
      data: { companyId: invitation.companyId, userId: user.id, role: invitation.role },
      select: { id: true, role: true, company: { select: { id: true, name: true } } },
    });
    await tx.companyInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    await recordAudit(tx, {
      actor: toAuditActor(user),
      action: "company.member_joined",
      entityType: "Company",
      entityId: invitation.companyId,
      metadata: { memberId: member.id, invitationId: invitation.id },
    });
    return member;
  });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listCompaniesForAdmin(query: z.infer<typeof adminCompanyListQuery>) {
  const where: Prisma.CompanyWhereInput = {
    ...(query.status ? { verificationStatus: query.status } : {}),
    ...(query.state ? { state: query.state } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { rcNumber: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const rows = await db.company.findMany({
    where,
    select: { ...companySelect, _count: { select: { openings: true, members: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...cursorArgs(query),
  });
  return toPage(rows, query.limit);
}

export async function getCompanyForAdmin(companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      ...companySelect,
      members: {
        select: {
          id: true,
          role: true,
          jobTitle: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      openings: { select: { id: true, title: true, status: true, slots: true, state: true } },
    },
  });
  if (!company) throw errors.notFound("Company");
  return company;
}

/** Verify, reject, suspend or reinstate a company. */
export async function changeCompanyStatus(
  actor: AuditActor,
  companyId: string,
  to: CompanyVerificationStatus,
  reason?: string,
) {
  const result = await db.$transaction(async (tx) => {
    const current = await tx.company.findUnique({
      where: { id: companyId },
      include: {
        members: { select: { role: true, user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!current) throw errors.notFound("Company");
    companyMachine.assert(current.verificationStatus, to, "ADMIN");
    if ((to === "REJECTED" || to === "SUSPENDED") && !reason) {
      throw errors.badRequest("Give a reason when rejecting or suspending a company");
    }

    const { count } = await tx.company.updateMany({
      where: { id: companyId, verificationStatus: current.verificationStatus },
      data: {
        verificationStatus: to,
        statusReason: reason ?? null,
        ...(to === "VERIFIED" && !current.verifiedAt ? { verifiedAt: new Date() } : {}),
      },
    });
    if (count === 0)
      throw errors.conflict("This company was changed by someone else. Refresh and try again.");

    let closedOpenings = 0;
    if (to === "SUSPENDED") {
      // A suspended company should not receive new graduates.
      closedOpenings = (
        await tx.internshipOpening.updateMany({
          where: { companyId, status: "OPEN" },
          data: { status: "CLOSED" },
        })
      ).count;
    }
    await recordAudit(tx, {
      actor,
      action: "company.status_changed",
      entityType: "Company",
      entityId: companyId,
      before: { verificationStatus: current.verificationStatus },
      after: { verificationStatus: to },
      ...(closedOpenings ? { metadata: { closedOpenings } } : {}),
    });
    for (const m of current.members) {
      await createNotification(tx, {
        userId: m.user.id,
        type: "company.status_changed",
        title: to === "VERIFIED" ? "Company verified" : "Company status update",
        body:
          to === "VERIFIED"
            ? `${current.name} is now verified. You can publish internship openings.`
            : `${current.name} is now ${to.toLowerCase()}.${reason ? ` Reason: ${reason}` : ""}`,
        data: { companyId, status: to },
      });
    }
    return { company: current, owners: current.members.filter((m) => m.role === "OWNER") };
  });

  if (to === "VERIFIED") {
    for (const owner of result.owners) {
      await sendEmail({
        template: "company-verified",
        to: owner.user.email,
        toUserId: owner.user.id,
        idempotencyKey: `company-verified:${companyId}:${owner.user.id}`,
        props: {
          firstName: firstNameOf(owner.user.name),
          companyName: result.company.name,
          dashboardUrl: `${env().APP_URL}/company/openings`,
        },
      });
    }
  }
  return getCompanyForAdmin(companyId);
}
