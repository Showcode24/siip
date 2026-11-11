import { db, type DbOrTx } from "@/server/db";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import { normaliseProfileUpdate } from "@/server/lib/profile-rules";
import {
  computeCompleteness,
  missingForApplication,
  type ProfileForScoring,
} from "@/server/lib/profile-completeness";
import {
  UPLOAD_KINDS,
  confirmUpload,
  createSignedUpload,
  deleteAsset,
  privateDownloadUrl,
} from "@/server/storage/cloudinary";
import type { UpdateProfileInput } from "@/server/validators/graduate";
import { presentSkill, skillSelect } from "./skill.service";

const profileSelect = {
  id: true,
  firstName: true,
  lastName: true,
  otherNames: true,
  phone: true,
  internType: true,
  country: true,
  city: true,
  workPreference: true,
  stateOfResidence: true,
  lga: true,
  institution: true,
  courseOfStudy: true,
  degreeClass: true,
  graduationYear: true,
  nyscStatus: true,
  currentPpa: true,
  nyscStateCode: true,
  nyscBatch: true,
  availability: true,
  bio: true,
  cvPublicId: true,
  cvUploadedAt: true,
  photoUrl: true,
  completenessScore: true,
  searchable: true,
  visibility: true,
  updatedAt: true,
  reviewStatus: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  skills: { select: skillSelect, orderBy: { createdAt: "asc" } },
} as const;

type ProfileRow = NonNullable<Awaited<ReturnType<typeof findProfile>>>;

function findProfile(client: DbOrTx, graduateId: string) {
  return client.graduateProfile.findUnique({ where: { id: graduateId }, select: profileSelect });
}

function scoringInput(p: ProfileRow): ProfileForScoring {
  return { ...p, skillCount: p.skills.length };
}

/** Shapes the profile for its owner. The CV's storage id stays server-side. */
function present(p: ProfileRow) {
  const { cvPublicId, skills, ...rest } = p;
  return {
    ...rest,
    cv: { uploaded: Boolean(cvPublicId), uploadedAt: p.cvUploadedAt },
    skills: skills.map(presentSkill),
    missingForApplication: missingForApplication(scoringInput(p)),
    skillsWithoutProof: skills.filter((s) => s.documents.length === 0).map((s) => presentSkill(s).name),
  };
}

/** Recomputes and stores the completeness score. Call after any profile change. */
async function refreshCompleteness(client: DbOrTx, graduateId: string): Promise<ProfileRow> {
  const profile = await findProfile(client, graduateId);
  if (!profile) throw errors.notFound("Profile");
  const score = computeCompleteness(scoringInput(profile));
  if (score === profile.completenessScore) return profile;
  await client.graduateProfile.update({ where: { id: graduateId }, data: { completenessScore: score } });
  return { ...profile, completenessScore: score };
}

export async function getProfile(graduateId: string) {
  const profile = await findProfile(db, graduateId);
  if (!profile) throw errors.notFound("Profile");
  return present(profile);
}

export async function updateProfile(graduateId: string, input: UpdateProfileInput) {
  const profile = await db.$transaction(async (tx) => {
    const current = await tx.graduateProfile.findUnique({
      where: { id: graduateId },
      select: { country: true, internType: true },
    });
    if (!current) throw errors.notFound("Profile");
    await tx.graduateProfile.update({ where: { id: graduateId }, data: normaliseProfileUpdate(current, input) });
    return refreshCompleteness(tx, graduateId);
  });
  return present(profile);
}

export async function listSkills() {
  return db.skill.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, category: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

// ─── Uploads ──────────────────────────────────────────────────────────────────

export type GraduateUploadKind = "cv" | "photo";

/** Signed parameters for a direct browser → Cloudinary upload, scoped to this graduate. */
export function signGraduateUpload(graduateId: string, kind: GraduateUploadKind, extension?: string) {
  return createSignedUpload(kind, graduateId, extension);
}

/**
 * Verifies the uploaded file (type, size, ownership), attaches it to the profile
 * and removes the file it replaces.
 */
export async function confirmGraduateUpload(graduateId: string, kind: GraduateUploadKind, publicId: string) {
  const upload = await confirmUpload(kind, graduateId, publicId);
  const previous = await db.graduateProfile.findUniqueOrThrow({
    where: { id: graduateId },
    select: { cvPublicId: true, photoPublicId: true },
  });

  const profile = await db.$transaction(async (tx) => {
    await tx.graduateProfile.update({
      where: { id: graduateId },
      data:
        kind === "cv"
          ? { cvPublicId: upload.publicId, cvUploadedAt: new Date() }
          : { photoPublicId: upload.publicId, photoUrl: upload.url },
    });
    return refreshCompleteness(tx, graduateId);
  });

  const old = kind === "cv" ? previous.cvPublicId : previous.photoPublicId;
  if (old && old !== upload.publicId) {
    const k = UPLOAD_KINDS[kind];
    await deleteAsset(old, k.resourceType, k.deliveryType);
  }
  return present(profile);
}

/** Short-lived signed link to a graduate's CV. Callers must check access first. */
export async function getCvDownloadUrl(graduateId: string) {
  const profile = await db.graduateProfile.findUnique({
    where: { id: graduateId },
    select: { cvPublicId: true },
  });
  if (!profile) throw errors.notFound("Graduate");
  if (!profile.cvPublicId) throw errors.notFound("CV");
  const ttlSeconds = 600;
  return {
    url: privateDownloadUrl(profile.cvPublicId, UPLOAD_KINDS.cv.resourceType, ttlSeconds),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  };
}

/** Admin access to a CV is personal-data access, so it is audited. */
export async function getCvDownloadUrlForAdmin(actor: AuditActor, graduateId: string) {
  const link = await getCvDownloadUrl(graduateId);
  await recordAudit(db, {
    actor,
    action: "graduate.cv_accessed",
    entityType: "GraduateProfile",
    entityId: graduateId,
  });
  return link;
}
