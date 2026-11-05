// NDPA 2023: right of access (data export) and right to erasure
// (soft delete now, anonymise after a grace period).
import { verifyPassword } from "better-auth/crypto";
import type { CurrentUser } from "@/server/auth/session";
import { toAuditActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { recordAudit } from "@/server/lib/audit";
import { AppError, errors } from "@/server/lib/errors";
import { applicationMachine } from "@/server/lib/state-machine";
import { UPLOAD_KINDS, deleteAsset } from "@/server/storage/cloudinary";
import { sendApplicationEmail, transitionApplication, type ApplicationChange } from "./application.service";

/** Days between a deletion request and anonymisation (time to reverse mistakes or fraud). */
export const DELETION_GRACE_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

/** Everything SIIP holds about the user, as JSON. Answer keys and internal admin notes are excluded. */
export async function exportMyData(user: CurrentUser) {
  const data = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      consentAt: true,
      consentVersion: true,
      createdAt: true,
      graduateProfile: {
        include: {
          skills: { select: { level: true, skill: { select: { name: true } } } },
          applications: {
            select: {
              id: true,
              status: true,
              motivation: true,
              rejectionReason: true,
              createdAt: true,
              cohort: { select: { name: true } },
              events: { select: { fromStatus: true, toStatus: true, note: true, createdAt: true } },
            },
          },
          lessonProgress: { select: { completedAt: true, lesson: { select: { title: true } } } },
          attempts: {
            select: {
              attemptNumber: true,
              status: true,
              startedAt: true,
              submittedAt: true,
              percentage: true,
              passed: true,
              assessment: { select: { title: true, type: true } },
            },
          },
          matches: {
            select: { status: true, score: true, createdAt: true, opening: { select: { title: true } } },
          },
          placements: {
            select: {
              status: true,
              startDate: true,
              endDate: true,
              offeredPermanentRole: true,
              company: { select: { name: true } },
              checkIns: { where: { authorType: "INTERN" } },
              evaluation: true,
            },
          },
          certificates: { select: { serialNumber: true, verificationCode: true, issuedAt: true } },
        },
      },
      companyMember: { select: { role: true, jobTitle: true, company: { select: { name: true } } } },
      notifications: { select: { title: true, body: true, readAt: true, createdAt: true } },
    },
  });
  await db.$transaction(async (tx) => {
    await tx.dataRequest.create({
      data: { userId: user.id, type: "EXPORT", status: "COMPLETED", completedAt: new Date() },
    });
    await recordAudit(tx, {
      actor: toAuditActor(user),
      action: "privacy.data_exported",
      entityType: "User",
      entityId: user.id,
    });
  });
  // Internal storage ids are not personal data and mean nothing outside SIIP.
  const profile = data.graduateProfile;
  const cleaned = profile
    ? { ...profile, cvPublicId: undefined, photoPublicId: undefined, hasCv: Boolean(profile.cvPublicId) }
    : null;
  return { exportedAt: new Date().toISOString(), ...data, graduateProfile: cleaned };
}

/**
 * Soft-deletes the account: sign-in stops immediately, the current application
 * is withdrawn, and personal data is anonymised after the grace period.
 */
export async function requestAccountDeletion(user: CurrentUser, password: string) {
  const account = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { password: true },
  });
  if (!account?.password || !(await verifyPassword({ hash: account.password, password }))) {
    throw new AppError("UNAUTHENTICATED", "Incorrect password");
  }

  const [activePlacement, ownership] = await Promise.all([
    db.placement.findFirst({
      where: { status: "ACTIVE", graduate: { userId: user.id } },
      select: { id: true },
    }),
    db.companyMember.findFirst({ where: { userId: user.id, role: "OWNER" }, select: { id: true } }),
  ]);
  if (activePlacement) {
    throw errors.conflict(
      "You have an active internship. Please contact SIIP to end it before deleting your account.",
    );
  }
  if (ownership) {
    throw errors.conflict("You own a company account. Please contact SIIP to transfer ownership first.");
  }

  const changes = await db.$transaction(async (tx) => {
    const now = new Date();
    await tx.user.update({ where: { id: user.id }, data: { deletedAt: now } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.dataRequest.create({ data: { userId: user.id, type: "DELETION" } });

    const out: ApplicationChange[] = [];
    const apps = await tx.application.findMany({
      where: { graduate: { userId: user.id } },
      select: { id: true, status: true },
    });
    for (const app of apps) {
      if (!applicationMachine.can(app.status, "WITHDRAWN", "GRADUATE")) continue;
      out.push(
        await transitionApplication(tx, {
          applicationId: app.id,
          to: "WITHDRAWN",
          actor: "GRADUATE",
          auditActor: toAuditActor(user),
          reason: "Account deleted",
        }),
      );
    }
    await recordAudit(tx, {
      actor: toAuditActor(user),
      action: "privacy.deletion_requested",
      entityType: "User",
      entityId: user.id,
      metadata: { anonymiseAfterDays: DELETION_GRACE_DAYS },
    });
    return out;
  });
  // Recipients are flagged deleted, so these only write notifications; no emails go out.
  for (const change of changes) await sendApplicationEmail(change);
  return { deleted: true, anonymiseAfter: new Date(Date.now() + DELETION_GRACE_DAYS * DAY) };
}

/**
 * Replaces personal data with placeholders. Keeps non-identifying fields
 * (state, institution, course, statuses) so programme statistics stay correct.
 */
export async function anonymiseUser(userId: string) {
  const profile = await db.graduateProfile.findUnique({
    where: { userId },
    select: { id: true, cvPublicId: true, photoPublicId: true },
  });
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Deleted user",
        email: `deleted-${userId}@deleted.invalid`,
        image: null,
        anonymisedAt: new Date(),
      },
    });
    await tx.account.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.emailLog.updateMany({ where: { toUserId: userId }, data: { toEmail: "[deleted]" } });
    if (profile) {
      await tx.graduateProfile.update({
        where: { id: profile.id },
        data: {
          firstName: "Deleted",
          lastName: "User",
          otherNames: null,
          phone: null,
          lga: null,
          bio: null,
          currentPpa: null,
          cvPublicId: null,
          cvUploadedAt: null,
          photoUrl: null,
          photoPublicId: null,
          searchable: false,
          visibility: "PRIVATE",
        },
      });
      await tx.application.updateMany({ where: { graduateId: profile.id }, data: { motivation: null } });
      await tx.checkIn.updateMany({
        where: { placement: { graduateId: profile.id }, authorType: "INTERN" },
        data: { progressNote: "[deleted]", challenges: null },
      });
    }
    await tx.dataRequest.updateMany({
      where: { userId, type: "DELETION", status: "PENDING" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await recordAudit(tx, {
      actor: null,
      action: "privacy.user_anonymised",
      entityType: "User",
      entityId: userId,
    });
  });
  if (profile?.cvPublicId) {
    await deleteAsset(profile.cvPublicId, UPLOAD_KINDS.cv.resourceType, UPLOAD_KINDS.cv.deliveryType);
  }
  if (profile?.photoPublicId) {
    await deleteAsset(
      profile.photoPublicId,
      UPLOAD_KINDS.photo.resourceType,
      UPLOAD_KINDS.photo.deliveryType,
    );
  }
}

/** Users whose grace period has passed. Used by the daily cron. */
export function findUsersDueForAnonymisation(now = new Date()) {
  return db.user.findMany({
    where: { deletedAt: { lte: new Date(now.getTime() - DELETION_GRACE_DAYS * DAY) }, anonymisedAt: null },
    select: { id: true },
    take: 200,
  });
}
