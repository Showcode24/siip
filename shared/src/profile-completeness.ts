// Profile completeness and the minimum profile needed to apply to a cohort.
// Pure functions so they can be unit-tested and reused by the seed.

export interface ProfileForScoring {
  /** Undergraduates have no degree class yet, so it isn't counted against them. */
  internType?: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  workPreference: string | null;
  institution: string | null;
  courseOfStudy: string | null;
  degreeClass: string | null;
  graduationYear: number | null;
  availability: string | null;
  bio: string | null;
  cvPublicId: string | null;
  photoUrl: string | null;
  skillCount: number;
}

type Field = Exclude<keyof ProfileForScoring, "skillCount" | "internType">;

/** Weights sum to 100. Skills are scored separately (see SKILLS_WEIGHT). */
const FIELD_WEIGHTS: Record<Field, number> = {
  phone: 10,
  country: 0,
  city: 5,
  workPreference: 5,
  institution: 10,
  courseOfStudy: 10,
  degreeClass: 5,
  graduationYear: 5,
  availability: 10,
  bio: 10,
  cvPublicId: 15,
  photoUrl: 5,
};
const SKILLS_WEIGHT = 10;
/** Number of skills that earns the full skills weight. */
const SKILLS_TARGET = 3;

const isFilled = (v: string | number | null) => v !== null && String(v).trim() !== "";
const notApplicable = (p: ProfileForScoring, field: Field) =>
  field === "degreeClass" && p.internType === "UNDERGRADUATE";

export function computeCompleteness(p: ProfileForScoring): number {
  let score = 0;
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS) as Array<[Field, number]>) {
    if (isFilled(p[field]) || notApplicable(p, field)) score += weight;
  }
  score += Math.round((Math.min(p.skillCount, SKILLS_TARGET) / SKILLS_TARGET) * SKILLS_WEIGHT);
  return score;
}

/**
 * Fields a graduate must complete before applying to a cohort.
 * Business rule: screening needs contact, education, availability, a CV and skills.
 */
const REQUIRED_TO_APPLY: Array<{ key: Field | "skills"; label: string }> = [
  { key: "phone", label: "Phone number" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "workPreference", label: "Work preference" },
  { key: "institution", label: "Institution" },
  { key: "courseOfStudy", label: "Course of study" },
  { key: "graduationYear", label: "Graduation year" },
  { key: "availability", label: "Availability" },
  { key: "cvPublicId", label: "CV (PDF)" },
  { key: "skills", label: "At least one skill" },
];

/** Labels of the fields still missing before the graduate may apply. Empty = ready. */
export function missingForApplication(p: ProfileForScoring): string[] {
  return REQUIRED_TO_APPLY.filter(({ key }) =>
    key === "skills" ? p.skillCount === 0 : !isFilled(p[key]),
  ).map(({ label }) => label);
}
