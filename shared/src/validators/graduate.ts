import { z } from "zod";
import { COUNTRY_CODES } from "../countries";
import { Availability, DegreeClass, InternType, NyscStatus, ProfileVisibility, SkillLevel, WorkMode } from "../enums";
import { NIGERIAN_STATES } from "../nigeria";
import { normalisePhone } from "../phone";
import { optionalText } from "./common";

const phone = z
  .string()
  .trim()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const normalised = normalisePhone(v);
    if (!normalised) {
      ctx.addIssue({ code: "custom", message: "Enter your number with its country code, e.g. +44 7700 900123" });
      return z.NEVER;
    }
    return normalised;
  });

const thisYear = new Date().getFullYear();

// Every field is optional: PATCH semantics. `null` clears a field.
export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    otherNames: optionalText(80),
    phone,
    internType: z.enum(InternType),
    country: z.enum(COUNTRY_CODES, { message: "Choose a country from the list" }),
    city: optionalText(80),
    workPreference: z.enum(WorkMode).nullable(),
    // Nigeria only: the service clears these when the country isn't Nigeria.
    stateOfResidence: z.enum(NIGERIAN_STATES).nullable(),
    lga: optionalText(80),
    institution: optionalText(160),
    courseOfStudy: optionalText(120),
    degreeClass: z.enum(DegreeClass).nullable(),
    graduationYear: z
      .number()
      .int()
      .min(1980)
      // Undergraduates give their expected year.
      .max(thisYear + 8)
      .nullable(),
    nyscStatus: z.enum(NyscStatus),
    currentPpa: optionalText(160),
    // NYSC corps members only, e.g. LA/24A/1234.
    nyscStateCode: z
      .string()
      .trim()
      .toUpperCase()
      .nullish()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^[A-Z]{2}\/\d{2}[A-C]\/\d{3,6}$/.test(v), {
        message: "Use the format on your call-up letter, e.g. LA/24A/1234",
      }),
    nyscBatch: optionalText(30),
    availability: z.enum(Availability).nullable(),
    bio: optionalText(1500),
    // Phase 2 prep: opt-in to being found by verified companies.
    searchable: z.boolean(),
    visibility: z.enum(ProfileVisibility),
  })
  .partial()
  .strict();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Skills with proof ────────────────────────────────────────────────────────

/** Limits for the documents that back up a skill. */
export const SKILL_DOCS = {
  maxPerSkill: 5,
  maxBytes: 5 * 1024 * 1024,
  formats: ["pdf", "jpg", "jpeg", "png"] as const,
} as const;
export const MAX_SKILLS = 20;

const skillId = z.string().min(1).max(64);
const issuedAt = z.iso
  .date({ message: "Enter a valid date" })
  .refine((d) => new Date(d) <= new Date(), "The date can't be in the future")
  .nullish()
  .transform((v) => v ?? null);

/** A skill from the list, or "Other" with its own name (exactly one of the two). */
export const addSkillSchema = z
  .object({
    skillId: skillId.nullish(),
    otherName: z.string().trim().min(2, "Name the skill").max(80).nullish(),
    level: z.enum(SkillLevel),
    issuingBody: optionalText(120),
    issuedAt,
  })
  .strict()
  .refine((s) => Boolean(s.skillId) !== Boolean(s.otherName), {
    message: "Choose a skill from the list, or choose Other and name it",
    path: ["skillId"],
  });
export type AddSkillInput = z.infer<typeof addSkillSchema>;

export const updateSkillSchema = z
  .object({ level: z.enum(SkillLevel), issuingBody: optionalText(120), issuedAt })
  .partial()
  .strict();
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

export const skillLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/, message: "Enter a full link, starting with https://" }).max(500),
});

export const skillFileSchema = z.object({
  publicId: z.string().min(1).max(255),
  fileName: z.string().trim().min(1).max(200),
});

/** Proof for a skill: an uploaded file (confirmed after upload) or a link. */
export const skillDocumentSchema = z.discriminatedUnion("kind", [
  skillFileSchema.extend({ kind: z.literal("FILE") }),
  skillLinkSchema.extend({ kind: z.literal("LINK") }),
]);

export const graduateUploadKind = z.enum(["cv", "photo"]);

export const signUploadSchema = z.object({
  kind: graduateUploadKind,
  extension: z.string().trim().toLowerCase().max(10).optional(),
});

export const confirmUploadSchema = z.object({
  kind: graduateUploadKind,
  publicId: z.string().min(1).max(255),
});
