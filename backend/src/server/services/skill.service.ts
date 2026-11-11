// An intern's skills and the documents that prove them.
//
// Rules: every skill needs at least one document (an uploaded file or a link)
// before the profile can go to SIIP for review. Each skill is checked on its
// own (PENDING → VERIFIED at a level SIIP confirms, or REJECTED with a reason).
// Companies only ever see verified skills, at the verified level.
import type { Prisma } from "@/generated/prisma/client";
import { db, type DbOrTx } from "@/server/db";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { AppError, errors } from "@/server/lib/errors";
import { missingForApplication } from "@/server/lib/profile-completeness";
import {
  UPLOAD_KINDS,
  confirmUpload,
  createSignedUpload,
  deleteAsset,
  privateDownloadUrl,
} from "@/server/storage/cloudinary";
import {
  MAX_SKILLS,
  SKILL_DOCS,
  type AddSkillInput,
  type UpdateSkillInput,
} from "@/server/validators/graduate";

export const skillSelect = {
  id: true,
  skillId: true,
  otherName: true,
  level: true,
  verifiedLevel: true,
  status: true,
  rejectionReason: true,
  issuingBody: true,
  issuedAt: true,
  reviewedAt: true,
  createdAt: true,
  skill: { select: { name: true, category: true } },
  documents: {
    // The storage id (publicId) never leaves the server.
    select: { id: true, kind: true, fileName: true, format: true, bytes: true, url: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
} as const satisfies Prisma.GraduateSkillSelect;

type SkillRow = Prisma.GraduateSkillGetPayload<{ select: typeof skillSelect }>;

/** A skill as its owner and SIIP admins see it (claimed level, status, documents). */
export function presentSkill(s: SkillRow) {
  return {
    id: s.id,
    skillId: s.skillId,
    name: s.skill?.name ?? s.otherName ?? "Skill",
    category: s.skill?.category ?? "Other",
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

/** Fields that reset a checked skill to PENDING when they change. */
const CLAIM_FIELDS = ["level", "issuingBody", "issuedAt"] as const;
const BACK_TO_PENDING = {
  status: "PENDING",
  verifiedLevel: null,
  rejectionReason: null,
  reviewedAt: null,
  reviewedById: null,
} as const;

async function ownSkill(client: DbOrTx, graduateId: string, graduateSkillId: string) {
  const skill = await client.graduateSkill.findFirst({
    where: { id: graduateSkillId, graduateId },
    select: { id: true, status: true, level: true, issuingBody: true, issuedAt: true, _count: { select: { documents: true } } },
  });
  if (!skill) throw errors.notFound("Skill");
  return skill;
}

async function loadSkill(client: DbOrTx, graduateSkillId: string) {
  return presentSkill(await client.graduateSkill.findUniqueOrThrow({ where: { id: graduateSkillId }, select: skillSelect }));
}

export async function listMySkills(graduateId: string) {
  const rows = await db.graduateSkill.findMany({
    where: { graduateId },
    select: skillSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(presentSkill);
}

export async function addSkill(graduateId: string, input: AddSkillInput) {
  return db.$transaction(async (tx) => {
    const count = await tx.graduateSkill.count({ where: { graduateId } });
    if (count >= MAX_SKILLS) throw errors.badRequest(`You can list up to ${MAX_SKILLS} skills`);
    if (input.skillId) {
      const skill = await tx.skill.findFirst({ where: { id: input.skillId, isActive: true }, select: { id: true } });
      if (!skill) throw errors.badRequest("That skill is not available");
      if (await tx.graduateSkill.findFirst({ where: { graduateId, skillId: input.skillId }, select: { id: true } })) {
        throw errors.conflict("You've already listed this skill");
      }
    } else {
      const clash = await tx.graduateSkill.findFirst({
        where: { graduateId, otherName: { equals: input.otherName!, mode: "insensitive" } },
        select: { id: true },
      });
      if (clash) throw errors.conflict("You've already listed this skill");
    }
    const created = await tx.graduateSkill.create({
      data: {
        graduateId,
        skillId: input.skillId ?? null,
        otherName: input.skillId ? null : input.otherName,
        level: input.level,
        issuingBody: input.issuingBody,
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
      },
      select: { id: true },
    });
    return loadSkill(tx, created.id);
  });
}

export async function updateSkill(graduateId: string, graduateSkillId: string, input: UpdateSkillInput) {
  return db.$transaction(async (tx) => {
    const current = await ownSkill(tx, graduateId, graduateSkillId);
    const next = {
      ...(input.level !== undefined ? { level: input.level } : {}),
      ...(input.issuingBody !== undefined ? { issuingBody: input.issuingBody } : {}),
      ...(input.issuedAt !== undefined ? { issuedAt: input.issuedAt ? new Date(input.issuedAt) : null } : {}),
    };
    const claimChanged = CLAIM_FIELDS.some((k) => {
      if (!(k in next)) return false;
      const a = next[k as keyof typeof next];
      const b = current[k];
      return (a instanceof Date ? a.getTime() : a) !== (b instanceof Date ? b.getTime() : b);
    });
    await tx.graduateSkill.update({
      where: { id: graduateSkillId },
      data: { ...next, ...(claimChanged && current.status !== "PENDING" ? BACK_TO_PENDING : {}) },
    });
    return loadSkill(tx, graduateSkillId);
  });
}

export async function removeSkill(graduateId: string, graduateSkillId: string) {
  const docs = await db.$transaction(async (tx) => {
    await ownSkill(tx, graduateId, graduateSkillId);
    const files = await tx.skillDocument.findMany({
      where: { graduateSkillId, kind: "FILE" },
      select: { publicId: true },
    });
    await tx.graduateSkill.delete({ where: { id: graduateSkillId } });
    return files;
  });
  const kind = UPLOAD_KINDS.skillDoc;
  await Promise.all(docs.map((d) => d.publicId && deleteAsset(d.publicId, kind.resourceType, kind.deliveryType)));
  return { deleted: true };
}

// ─── Documents ────────────────────────────────────────────────────────────────

async function assertRoomForDocument(tx: DbOrTx, graduateId: string, graduateSkillId: string) {
  const skill = await ownSkill(tx, graduateId, graduateSkillId);
  if (skill._count.documents >= SKILL_DOCS.maxPerSkill) {
    throw errors.badRequest(`A skill can have up to ${SKILL_DOCS.maxPerSkill} documents`);
  }
  return skill;
}

/** New proof for a rejected skill asks SIIP to look again. */
const reopenIfRejected = (status: string) => (status === "REJECTED" ? BACK_TO_PENDING : {});

/** Step 1 of a file upload: signed fields for a direct browser → Cloudinary POST. */
export async function signSkillDocument(graduateId: string, graduateSkillId: string) {
  await assertRoomForDocument(db, graduateId, graduateSkillId);
  return createSignedUpload("skillDoc", graduateId);
}

/** Step 2: check the uploaded file (type, size, ownership) and attach it to the skill. */
export async function addSkillFile(
  graduateId: string,
  graduateSkillId: string,
  input: { publicId: string; fileName: string },
) {
  await assertRoomForDocument(db, graduateId, graduateSkillId);
  const upload = await confirmUpload("skillDoc", graduateId, input.publicId);
  return db.$transaction(async (tx) => {
    const skill = await assertRoomForDocument(tx, graduateId, graduateSkillId);
    await tx.skillDocument.create({
      data: {
        graduateSkillId,
        kind: "FILE",
        publicId: upload.publicId,
        fileName: input.fileName,
        format: upload.format,
        bytes: upload.bytes,
      },
    });
    await tx.graduateSkill.update({ where: { id: graduateSkillId }, data: reopenIfRejected(skill.status) });
    return loadSkill(tx, graduateSkillId);
  });
}

export async function addSkillLink(graduateId: string, graduateSkillId: string, url: string) {
  return db.$transaction(async (tx) => {
    const skill = await assertRoomForDocument(tx, graduateId, graduateSkillId);
    await tx.skillDocument.create({ data: { graduateSkillId, kind: "LINK", url } });
    await tx.graduateSkill.update({ where: { id: graduateSkillId }, data: reopenIfRejected(skill.status) });
    return loadSkill(tx, graduateSkillId);
  });
}

export async function removeSkillDocument(graduateId: string, graduateSkillId: string, documentId: string) {
  const removed = await db.$transaction(async (tx) => {
    const skill = await ownSkill(tx, graduateId, graduateSkillId);
    const doc = await tx.skillDocument.findFirst({ where: { id: documentId, graduateSkillId } });
    if (!doc) throw errors.notFound("Document");
    const profile = await tx.graduateProfile.findUniqueOrThrow({
      where: { id: graduateId },
      select: { reviewStatus: true },
    });
    if (skill._count.documents <= 1 && ["SUBMITTED", "APPROVED"].includes(profile.reviewStatus)) {
      throw errors.conflict("Each skill needs at least one document. Add another before removing this one.");
    }
    await tx.skillDocument.delete({ where: { id: documentId } });
    return doc;
  });
  if (removed.kind === "FILE" && removed.publicId) {
    const kind = UPLOAD_KINDS.skillDoc;
    await deleteAsset(removed.publicId, kind.resourceType, kind.deliveryType);
  }
  return loadSkill(db, graduateSkillId);
}

/**
 * Where to open a document: a short-lived signed link for files, the address
 * itself for links. `graduateId` scopes the lookup to its owner; admins pass null
 * (and the caller records the access).
 */
export async function getSkillDocumentUrl(graduateId: string | null, documentId: string) {
  const doc = await db.skillDocument.findFirst({
    where: { id: documentId, ...(graduateId ? { graduateSkill: { graduateId } } : {}) },
    select: { kind: true, publicId: true, url: true, graduateSkill: { select: { graduateId: true } } },
  });
  if (!doc) throw errors.notFound("Document");
  const ttlSeconds = 600;
  const url =
    doc.kind === "LINK" ? doc.url! : privateDownloadUrl(doc.publicId!, UPLOAD_KINDS.skillDoc.resourceType, ttlSeconds);
  return { url, kind: doc.kind, graduateId: doc.graduateSkill.graduateId, ...(doc.kind === "FILE" ? { expiresIn: ttlSeconds } : {}) };
}

export async function getSkillDocumentUrlForAdmin(actor: AuditActor, documentId: string) {
  const result = await getSkillDocumentUrl(null, documentId);
  await recordAudit(db, {
    actor,
    action: "skill_document.viewed",
    entityType: "SkillDocument",
    entityId: documentId,
    metadata: { graduateId: result.graduateId },
  });
  return result;
}

// ─── Submitting the profile for review ────────────────────────────────────────

/** What still blocks review: profile basics, at least one skill, proof for every skill. */
export async function reviewBlockers(client: DbOrTx, graduateId: string) {
  const profile = await client.graduateProfile.findUniqueOrThrow({
    where: { id: graduateId },
    select: {
      internType: true,
      phone: true,
      country: true,
      city: true,
      workPreference: true,
      institution: true,
      courseOfStudy: true,
      degreeClass: true,
      graduationYear: true,
      availability: true,
      bio: true,
      cvPublicId: true,
      photoUrl: true,
      skills: {
        select: { skillId: true, otherName: true, skill: { select: { name: true } }, _count: { select: { documents: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  const missing = missingForApplication({ ...profile, skillCount: profile.skills.length });
  const skillsWithoutProof = profile.skills
    .filter((s) => s._count.documents === 0)
    .map((s) => s.skill?.name ?? s.otherName ?? "Skill");
  return { missing, skillsWithoutProof };
}

export async function submitForReview(user: AuditActor, graduateId: string) {
  return db.$transaction(async (tx) => {
    const profile = await tx.graduateProfile.findUniqueOrThrow({
      where: { id: graduateId },
      select: { reviewStatus: true },
    });
    if (!["DRAFT", "CHANGES_REQUESTED"].includes(profile.reviewStatus)) {
      throw errors.conflict(
        profile.reviewStatus === "SUBMITTED" ? "Your profile is already with SIIP for review" : "Your profile is already approved",
      );
    }
    const { missing, skillsWithoutProof } = await reviewBlockers(tx, graduateId);
    if (missing.length || skillsWithoutProof.length) {
      throw new AppError(
        "BAD_REQUEST",
        skillsWithoutProof.length
          ? "Add at least one document to every skill before you submit"
          : "Complete your profile before you submit",
        { missing, skillsWithoutProof },
      );
    }
    const now = new Date();
    await tx.graduateProfile.update({
      where: { id: graduateId },
      data: { reviewStatus: "SUBMITTED", submittedAt: now, reviewNote: null },
    });
    await recordAudit(tx, {
      actor: user,
      action: "profile.submitted_for_review",
      entityType: "GraduateProfile",
      entityId: graduateId,
      before: { reviewStatus: profile.reviewStatus },
      after: { reviewStatus: "SUBMITTED" },
    });
    return { reviewStatus: "SUBMITTED" as const, submittedAt: now };
  });
}
