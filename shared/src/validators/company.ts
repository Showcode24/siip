import { z } from "zod";
import { CompanyVerificationStatus, OpeningStatus, SkillLevel, WorkMode, WorkSchedule } from "../enums";
import { COUNTRY_CODES } from "../countries";
import { NIGERIAN_STATES } from "../nigeria";
import { isTimeZone } from "../timezones";
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

/** Company registration number outside Nigeria (Companies House number, EIN, etc.). */
export const businessRegNumber = z
  .string()
  .trim()
  .min(3, "Enter your registration number")
  .max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ./-]*$/, "Use letters, numbers, spaces, dots, slashes or dashes");

const timeZone = z.string().trim().refine(isTimeZone, "Choose a time zone from the list");

const companyFields = z.object({
  name: z.string().trim().min(2).max(160),
  country: z.enum(COUNTRY_CODES, { message: "Choose a country from the list" }),
  city: z.string().trim().min(2, "Enter your city").max(80),
  timeZone,
  // Nigeria only: CAC number and state. Elsewhere: businessRegNumber.
  rcNumber: rcNumber.nullish(),
  businessRegNumber: businessRegNumber.nullish(),
  state: z.enum(NIGERIAN_STATES).nullish(),
  industry: z.string().trim().min(2).max(120),
  description: z.string().trim().max(3000).nullish(),
  address: z.string().trim().min(5).max(300),
  website: z
    .url({ protocol: /^https?$/ })
    .max(300)
    .nullish(),
});

export interface CompanyIdentity {
  country?: string | null;
  rcNumber?: string | null;
  businessRegNumber?: string | null;
  state?: string | null;
}

/**
 * Which registration details a company must give depends on its country:
 * Nigerian companies give a CAC number and state; others a registration number.
 */
export function companyIdentityProblems(c: CompanyIdentity): Array<{ path: keyof CompanyIdentity; message: string }> {
  if (!c.country) return [{ path: "country", message: "Choose a country from the list" }];
  if (c.country === "NG") {
    return [
      ...(!c.rcNumber ? [{ path: "rcNumber" as const, message: "Enter your CAC number, e.g. RC1234567" }] : []),
      ...(!c.state ? [{ path: "state" as const, message: "Choose your state" }] : []),
    ];
  }
  return !c.businessRegNumber
    ? [{ path: "businessRegNumber", message: "Enter your business registration number" }]
    : [];
}

/** Drops the details that don't apply to the company's country. */
export function normaliseCompanyIdentity<T extends CompanyIdentity>(c: T): T {
  return c.country === "NG"
    ? { ...c, businessRegNumber: null }
    : { ...c, rcNumber: null, state: null };
}

export const registerCompanySchema = companyFields
  .extend({ jobTitle: z.string().trim().max(120).optional() })
  .strict()
  .superRefine((c, ctx) => {
    for (const p of companyIdentityProblems(c)) ctx.addIssue({ code: "custom", path: [p.path], message: p.message });
  })
  .transform((c) => normaliseCompanyIdentity(c));
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
  // Where on-site and hybrid interns work; not needed for remote roles.
  country: z.enum(COUNTRY_CODES).nullish(),
  city: z.string().trim().min(2).max(80).nullish(),
  state: z.enum(NIGERIAN_STATES).nullish(),
  location: z.string().trim().max(200).nullish(),
  workMode: z.enum(WorkMode),
  schedule: z.enum(WorkSchedule),
  openToNysc: z.boolean().default(true),
  durationWeeks: z
    .number({ message: "Enter the length in weeks" })
    .int("Use whole weeks")
    .min(1, "At least 1 week")
    .max(52, "At most 52 weeks"),
  startDate: z.iso.date({ message: "Choose a start date" }),
  mayLeadToFullTime: z.boolean().default(false),
  // Each skill has its own level ("Any level" = no minimum). Required skills are
  // hard rules for matching; optional ones only help ranking.
  skills: z
    .array(openingSkill)
    .min(1, "Add at least one skill")
    .max(15)
    .refine((s) => new Set(s.map((x) => x.skillId)).size === s.length, "Each skill can only be listed once")
    .refine((s) => s.some((x) => x.required !== false), "Mark at least one skill as required"),
});

const today = () => new Date().toISOString().slice(0, 10);

export interface OpeningPlace {
  workMode?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
}

/** On-site and hybrid roles need a country and city (and a state in Nigeria). */
export function openingPlaceProblems(o: OpeningPlace): Array<{ path: keyof OpeningPlace; message: string }> {
  if (o.workMode === "REMOTE") return [];
  return [
    ...(!o.country ? [{ path: "country" as const, message: "Choose the country interns will work in" }] : []),
    ...(!o.city ? [{ path: "city" as const, message: "Enter the city interns will work in" }] : []),
    ...(o.country === "NG" && !o.state ? [{ path: "state" as const, message: "Choose the state" }] : []),
  ];
}

/** Remote roles have no place; Nigerian state only applies in Nigeria. */
export function normaliseOpeningPlace<T extends OpeningPlace>(o: T): T {
  if (o.workMode === "REMOTE") return { ...o, country: null, city: null, state: null };
  return o.country === "NG" ? o : { ...o, state: null };
}

export const createOpeningSchema = openingFields
  .strict()
  .superRefine((o, ctx) => {
    for (const p of openingPlaceProblems(o)) ctx.addIssue({ code: "custom", path: [p.path], message: p.message });
    if (o.startDate < today()) {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "The start date can't be in the past" });
    }
  })
  .transform((o) => normaliseOpeningPlace(o));
export type CreateOpeningInput = z.infer<typeof createOpeningSchema>;

/** Editing a whole opening in a form: same rules as creating, except a start date that has passed. */
export const editOpeningFormSchema = openingFields
  .strict()
  .superRefine((o, ctx) => {
    for (const p of openingPlaceProblems(o)) ctx.addIssue({ code: "custom", path: [p.path], message: p.message });
  })
  .transform((o) => normaliseOpeningPlace(o));

export const updateOpeningSchema = openingFields.partial().strict();
export type UpdateOpeningInput = z.infer<typeof updateOpeningSchema>;

export const openingStatusSchema = z.object({ status: z.enum(OpeningStatus) });

export const openingListQuery = paginationQuery.extend({ status: z.enum(OpeningStatus).optional() });

export const adminOpeningListQuery = openingListQuery.extend({
  companyId: id.optional(),
  cohortId: id.optional(),
  country: z.enum(COUNTRY_CODES).optional(),
  state: z.enum(NIGERIAN_STATES).optional(),
});

export const adminCompanyListQuery = paginationQuery.extend({
  status: z.enum(CompanyVerificationStatus).optional(),
  country: z.enum(COUNTRY_CODES).optional(),
  state: z.enum(NIGERIAN_STATES).optional(),
  q: z.string().trim().min(2).max(100).optional(),
});

export const companyStatusSchema = z.object({
  status: z.enum(CompanyVerificationStatus),
  reason: z.string().trim().min(3).max(1000).optional(),
});
