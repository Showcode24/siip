import { randomInt } from "node:crypto";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { env } from "@/server/env";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import { renderCertificatePdf } from "@/server/pdf/certificate";
import { privateDownloadUrl, uploadBuffer } from "@/server/storage/cloudinary";
import { createNotification } from "./notification.service";

// No 0/O or 1/I, so codes are easy to read out and type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = (length: number) =>
  Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const fmt = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
const verifyUrl = (code: string) => `${env().APP_URL}/verify?code=${code}`;

async function loadPlacementForCertificate(placementId: string) {
  const placement = await db.placement.findUnique({
    where: { id: placementId },
    include: {
      evaluation: { select: { id: true } },
      programmeEvaluation: true,
      certificate: true,
      opening: { select: { title: true } },
      company: { select: { name: true } },
      application: { select: { cohort: { select: { name: true } } } },
      graduate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          otherNames: true,
          user: { select: { id: true, email: true, deletedAt: true } },
        },
      },
    },
  });
  if (!placement) throw errors.notFound("Placement");
  return placement;
}

function assertReadyForReview(p: Awaited<ReturnType<typeof loadPlacementForCertificate>>) {
  if (p.status !== "COMPLETED") throw errors.conflict("The placement must be completed first");
  if (!p.evaluation) throw errors.conflict("The company has not submitted its evaluation yet");
}

/** The admin's final review. Approval is what allows a certificate to be issued. */
export async function reviewPlacement(
  actor: AuditActor,
  placementId: string,
  input: { notes?: string; approvedForCertificate: boolean },
) {
  const placement = await loadPlacementForCertificate(placementId);
  assertReadyForReview(placement);
  if (placement.certificate && !input.approvedForCertificate) {
    throw errors.conflict("A certificate has already been issued for this placement");
  }
  return db.$transaction(async (tx) => {
    const data = {
      reviewerId: actor.userId,
      notes: input.notes ?? null,
      approvedForCertificate: input.approvedForCertificate,
      approvedAt: input.approvedForCertificate ? new Date() : null,
    };
    const review = await tx.programmeEvaluation.upsert({
      where: { placementId },
      update: data,
      create: { placementId, ...data },
    });
    await recordAudit(tx, {
      actor,
      action: "placement.reviewed",
      entityType: "Placement",
      entityId: placementId,
      before: { approvedForCertificate: placement.programmeEvaluation?.approvedForCertificate ?? null },
      after: { approvedForCertificate: input.approvedForCertificate },
    });
    return review;
  });
}

/**
 * Issues the certificate (idempotent). The row is created first, so a retry
 * after a failed PDF upload reuses the same serial and code.
 */
export async function issueCertificate(actor: AuditActor, placementId: string) {
  const placement = await loadPlacementForCertificate(placementId);
  assertReadyForReview(placement);
  if (!placement.programmeEvaluation?.approvedForCertificate) {
    throw errors.conflict("Approve the placement for a certificate first");
  }
  if (placement.certificate?.pdfPublicId) return placement.certificate;

  const certificate =
    placement.certificate ??
    (await db.$transaction(async (tx) => {
      const created = await tx.certificate.create({
        data: {
          placementId,
          graduateId: placement.graduate.id,
          serialNumber: `SIIP-${new Date().getUTCFullYear()}-${randomCode(8)}`,
          verificationCode: `${randomCode(5)}-${randomCode(5)}`,
          approvedById: actor.userId,
        },
      });
      await recordAudit(tx, {
        actor,
        action: "certificate.issued",
        entityType: "Certificate",
        entityId: created.id,
        after: { placementId, serialNumber: created.serialNumber },
      });
      await createNotification(tx, {
        userId: placement.graduate.user.id,
        type: "certificate.issued",
        title: "Your certificate is ready",
        body: "Congratulations! Your SIIP certificate has been issued.",
        data: { certificateId: created.id },
      });
      return created;
    }));

  const { graduate } = placement;
  const pdf = await renderCertificatePdf({
    graduateName: [graduate.firstName, graduate.otherNames, graduate.lastName].filter(Boolean).join(" "),
    cohortName: placement.application.cohort?.name ?? "SIIP",
    companyName: placement.company.name,
    roleTitle: placement.opening.title,
    startDate: fmt(placement.startDate),
    endDate: fmt(placement.endedAt ?? placement.endDate),
    issueDate: fmt(certificate.issuedAt),
    serialNumber: certificate.serialNumber,
    verificationCode: certificate.verificationCode,
    verifyUrl: verifyUrl(certificate.verificationCode),
  });
  const upload = await uploadBuffer(pdf, {
    publicId: `siip/certificates/${certificate.id}.pdf`,
    resourceType: "raw",
    deliveryType: "authenticated",
  });
  const saved = await db.certificate.update({
    where: { id: certificate.id },
    data: { pdfPublicId: upload.publicId },
  });

  if (!graduate.user.deletedAt) {
    await sendEmail({
      template: "certificate-issued",
      to: graduate.user.email,
      toUserId: graduate.user.id,
      idempotencyKey: `certificate-issued:${certificate.id}`,
      props: {
        firstName: graduate.firstName,
        cohortName: placement.application.cohort?.name ?? "SIIP",
        downloadUrl: `${env().APP_URL}/dashboard/certificates`,
        verifyUrl: verifyUrl(certificate.verificationCode),
        verificationCode: certificate.verificationCode,
      },
    });
  }
  return saved;
}

// ─── Graduate ─────────────────────────────────────────────────────────────────

export function listMyCertificates(graduateId: string) {
  return db.certificate
    .findMany({
      where: { graduateId, revokedAt: null },
      select: {
        id: true,
        serialNumber: true,
        verificationCode: true,
        issuedAt: true,
        pdfPublicId: true,
        placement: { select: { company: { select: { name: true } }, opening: { select: { title: true } } } },
      },
      orderBy: { issuedAt: "desc" },
    })
    .then((rows) =>
      rows.map(({ pdfPublicId, ...c }) => ({
        ...c,
        ready: Boolean(pdfPublicId),
        verifyUrl: verifyUrl(c.verificationCode),
      })),
    );
}

export async function getMyCertificateDownload(graduateId: string, certificateId: string) {
  const cert = await db.certificate.findFirst({
    where: { id: certificateId, graduateId, revokedAt: null },
    select: { pdfPublicId: true },
  });
  if (!cert) throw errors.notFound("Certificate");
  if (!cert.pdfPublicId) throw errors.conflict("Your certificate is still being prepared");
  const ttlSeconds = 600;
  return {
    url: privateDownloadUrl(cert.pdfPublicId, "raw", ttlSeconds),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  };
}

// ─── Public ───────────────────────────────────────────────────────────────────

/** What an employer sees when checking a certificate: enough to confirm it, nothing more. */
export async function verifyCertificate(code: string) {
  const cert = await db.certificate.findUnique({
    where: { verificationCode: code },
    select: {
      serialNumber: true,
      issuedAt: true,
      revokedAt: true,
      graduate: { select: { firstName: true, lastName: true, otherNames: true } },
      placement: {
        select: {
          company: { select: { name: true } },
          opening: { select: { title: true } },
          application: { select: { cohort: { select: { name: true } } } },
        },
      },
    },
  });
  if (!cert) throw errors.notFound("Certificate");
  const g = cert.graduate;
  return {
    valid: !cert.revokedAt,
    graduateName: [g.firstName, g.otherNames, g.lastName].filter(Boolean).join(" "),
    cohortName: cert.placement.application.cohort?.name ?? "SIIP",
    companyName: cert.placement.company.name,
    roleTitle: cert.placement.opening.title,
    issuedAt: cert.issuedAt,
    serialNumber: cert.serialNumber,
  };
}
