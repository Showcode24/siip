import { z } from "zod";
import { CompanyVerificationStatus, OpeningStatus, SkillLevel, WorkMode, WorkSchedule } from "../enums";
import { NIGERIAN_STATES } from "../nigeria";
import { paginationQuery } from "../pagination";

const id = z.string().min(1).max(64);

/**
 * CAC registration number: RC (companies), BN (business names) or IT (trustees).
 * Stored as e.g. "RC1234567"; a bare number is taken to be RC.
 */
export const rcNumber = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const m = /^(RC|BN|IT)?[\s-]*(\d{3,8})$/i.exec(v);
    if (!m) {
      ctx.addIssue({ code: "custom", message: "Enter a valid CAC number, e.g. RC1234567" });
      return z.NEVER;
    }
    return `${(m[1] ?? "RC").toUpperCase()}${m[2]}`;
  });

const companyFields = z.object({
  name: z.string().trim().min(2).max(160),
  rcNumber,
  industry: z.string().trim().min(2).max(120),
  description: z.string().trim().max(3000).nullish(),
  address: z.string().trim().min(5).max(300),
  state: z.enum(NIGERIAN_STATES),
  website: z
    .url({ protocol: /^https?$/ })
    .max(300)
    .nullish(),
});

export const registerCompanySchema = companyFields
  .extend({ jobTitle: z.string().trim().max(120).optional() })
  .strict();
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

export const updateCompanySchema = companyFields.partial().strict();
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const logoSchema = z.object({ publicId: z.string().min(1).max(255) });

export const inviteSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
});

export const acceptInviteSchema = z.object({ token: z.string().min(20).max(200) });

const openingSkill = z.object({
  skillId: id,
  minLevel: z.enum(SkillLevel).nullish(),
  required: z.boolean().default(true),
});

const openingFields = z.object({
  cohortId: id.nullish(),
  title: z.string().trim().min(3).max(160),
  department: z.string().trim().max(120).nullish(),
  description: z.string().trim().min(20).max(5000),
  slots: z.number().int().min(1).max(100),
  preferredDisciplines: z.array(z.string().trim().min(2).max(120)).max(10).default([]),
  state: z.enum(NIGERIAN_STATES),
  location: z.string().trim().max(200).nullish(),
  workMode: z.enum(WorkMode),
  schedule: z.enum(WorkSchedule),
  openToNysc: z.boolean().default(true),
  skills: z
    .array(openingSkill)
    .min(1, "Add at least one required skill")
    .max(15)
    .refine((s) => new Set(s.map((x) => x.skillId)).size === s.length, "Each skill can only be listed once"),
});

export const createOpeningSchema = openingFields.strict();
export type CreateOpeningInput = z.infer<typeof createOpeningSchema>;

export const updateOpeningSchema = openingFields.partial().strict();
export type UpdateOpeningInput = z.infer<typeof updateOpeningSchema>;

export const openingStatusSchema = z.object({ status: z.enum(OpeningStatus) });

export const openingListQuery = paginationQuery.extend({ status: z.enum(OpeningStatus).optional() });

export const adminOpeningListQuery = openingListQuery.extend({
  companyId: id.optional(),
  cohortId: id.optional(),
  state: z.enum(NIGERIAN_STATES).optional(),
});

export const adminCompanyListQuery = paginationQuery.extend({
  status: z.enum(CompanyVerificationStatus).optional(),
  state: z.enum(NIGERIAN_STATES).optional(),
  q: z.string().trim().min(2).max(100).optional(),
});

export const companyStatusSchema = z.object({
  status: z.enum(CompanyVerificationStatus),
  reason: z.string().trim().min(3).max(1000).optional(),
});
