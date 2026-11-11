// Human labels and status tones for every backend enum, in one place.
import type {
  ApplicationStatus,
  Availability,
  CohortStatus,
  CompanyVerificationStatus,
  DegreeClass,
  InternType,
  ProfileReviewStatus,
  SkillStatus,
  MatchStatus,
  NyscStatus,
  OpeningStatus,
  PlacementStatus,
  SkillLevel,
  WorkMode,
  WorkSchedule,
  AttemptStatus,
} from "@siip/shared/enums";
import { countryName } from "@siip/shared/countries";

export type Tone = "neutral" | "info" | "brand" | "success" | "warning" | "danger" | "dark";

interface StatusMeta {
  label: string;
  tone: Tone;
}

export const APPLICATION_STATUS: Record<ApplicationStatus, StatusMeta> = {
  SUBMITTED: { label: "Submitted", tone: "neutral" },
  SCREENING: { label: "In screening", tone: "info" },
  SHORTLISTED: { label: "Shortlisted", tone: "brand" },
  IN_TRAINING: { label: "In training", tone: "brand" },
  FINAL_ASSESSMENT: { label: "Final assessment", tone: "warning" },
  // Approved by SIIP's skill review: waiting to be matched with a company.
  QUALIFIED: { label: "On the waiting list", tone: "success" },
  MATCHED: { label: "Matched", tone: "brand" },
  PLACED: { label: "Placed", tone: "success" },
  COMPLETED: { label: "Completed", tone: "dark" },
  REJECTED: { label: "Not selected", tone: "danger" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
};

export const COHORT_STATUS: Record<CohortStatus, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  APPLICATIONS_OPEN: { label: "Applications open", tone: "success" },
  APPLICATIONS_CLOSED: { label: "Applications closed", tone: "warning" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  COMPLETED: { label: "Completed", tone: "dark" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

export const COMPANY_STATUS: Record<CompanyVerificationStatus, StatusMeta> = {
  PENDING: { label: "Pending review", tone: "warning" },
  VERIFIED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

export const OPENING_STATUS: Record<OpeningStatus, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  OPEN: { label: "Open", tone: "success" },
  CLOSED: { label: "Closed", tone: "dark" },
};

export const MATCH_STATUS: Record<MatchStatus, StatusMeta> = {
  PROPOSED: { label: "Awaiting decision", tone: "warning" },
  COMPANY_ACCEPTED: { label: "Accepted", tone: "success" },
  COMPANY_REJECTED: { label: "Declined", tone: "danger" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
};

export const PLACEMENT_STATUS: Record<PlacementStatus, StatusMeta> = {
  ACTIVE: { label: "Active", tone: "brand" },
  COMPLETED: { label: "Completed", tone: "success" },
  TERMINATED: { label: "Ended early", tone: "danger" },
};

export const ATTEMPT_STATUS: Record<AttemptStatus, StatusMeta> = {
  IN_PROGRESS: { label: "In progress", tone: "warning" },
  SUBMITTED: { label: "Submitted", tone: "success" },
  EXPIRED: { label: "Time ran out", tone: "neutral" },
};

export const NYSC_STATUS: Record<NyscStatus, string> = {
  NOT_YET: "Not yet mobilised",
  SERVING: "Currently serving",
  COMPLETED: "Completed",
  EXEMPTED: "Exempted",
};

export const AVAILABILITY: Record<Availability, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  WEEKENDS: "Weekends only",
  FLEXIBLE: "Flexible",
};

export const DEGREE_CLASS: Record<DegreeClass, string> = {
  FIRST_CLASS: "First Class",
  SECOND_CLASS_UPPER: "Second Class Upper (2:1)",
  SECOND_CLASS_LOWER: "Second Class Lower (2:2)",
  THIRD_CLASS: "Third Class",
  PASS: "Pass",
  DISTINCTION: "Distinction (HND)",
  UPPER_CREDIT: "Upper Credit (HND/ND)",
  LOWER_CREDIT: "Lower Credit (HND/ND)",
  OTHER: "Other",
};

export const SKILL_LEVEL: Record<SkillLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};

/** What each level means, so interns claim honestly and SIIP checks consistently. */
export const SKILL_LEVEL_HINT: Record<SkillLevel, string> = {
  BEGINNER: "You've learned the basics and still need guidance",
  INTERMEDIATE: "You handle everyday tasks on your own",
  ADVANCED: "You handle complex work with little guidance",
  EXPERT: "You could teach others, with work to show for it",
};

export const SKILL_STATUS: Record<SkillStatus, StatusMeta> = {
  PENDING: { label: "Waiting for SIIP", tone: "warning" },
  VERIFIED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Not verified", tone: "danger" },
};

export const PROFILE_REVIEW: Record<ProfileReviewStatus, StatusMeta> = {
  DRAFT: { label: "Not sent yet", tone: "neutral" },
  SUBMITTED: { label: "With SIIP for review", tone: "info" },
  CHANGES_REQUESTED: { label: "More documents needed", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
};

export const WORK_MODE: Record<WorkMode, string> = { ONSITE: "On-site", REMOTE: "Remote", HYBRID: "Hybrid" };

export const INTERN_TYPE: Record<InternType, { label: string; hint: string }> = {
  NYSC_CORPS_MEMBER: { label: "NYSC corps member", hint: "Currently serving" },
  UNDERGRADUATE: { label: "Undergraduate", hint: "Still studying" },
  GRADUATE: { label: "Graduate", hint: "Finished your studies" },
};

/** "Any level", "Intermediate or above", "Expert only". */
export function levelWanted(l: SkillLevel | null): string {
  if (!l) return "Any level";
  return l === "EXPERT" ? "Expert only" : `${SKILL_LEVEL[l]} or above`;
}

/** "12 weeks from 3 Dec 2026, could lead to full-time". */
export function requestTiming(o: { durationWeeks: number | null; startDate: string | null; mayLeadToFullTime: boolean }): string {
  const parts = [
    o.durationWeeks ? `${o.durationWeeks} ${o.durationWeeks === 1 ? "week" : "weeks"}` : null,
    o.startDate
      ? `from ${new Date(o.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`
      : null,
  ].filter(Boolean);
  const when = parts.join(" ");
  return o.mayLeadToFullTime ? [when, "could lead to full-time"].filter(Boolean).join(", ") : when;
}

/** "CAC RC1234567" for Nigerian companies, "Reg. no. 12345678" elsewhere. */
export function companyRegistration(c: { rcNumber?: string | null; businessRegNumber?: string | null }): string {
  if (c.rcNumber) return `CAC ${c.rcNumber}`;
  if (c.businessRegNumber) return `Reg. no. ${c.businessRegNumber}`;
  return "No registration number";
}

/** Where an opening's interns work: "Remote", or "London, United Kingdom (Hybrid)". */
export function formatPlace(o: { workMode: WorkMode; city?: string | null; country?: string | null; state?: string | null }): string {
  if (o.workMode === "REMOTE") return "Remote";
  const where = formatLocation(o) || o.state || "Location not given";
  return `${where} (${WORK_MODE[o.workMode]})`;
}

/** "Nairobi, Kenya". Either part may be missing. */
export function formatLocation(p: { city?: string | null; country?: string | null }): string {
  return [p.city, p.country ? countryName(p.country) : null].filter(Boolean).join(", ");
}
export const WORK_SCHEDULE: Record<WorkSchedule, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  WEEKENDS: "Weekends",
};

/** The 7 programme stages graduates see, and which application statuses belong to each. */
/**
 * The intern's journey: prove skills, get them checked, wait to be matched,
 * do the internship, pass the SIIP test, get certified. (Cohorts and training
 * are retired.)
 */
export const JOURNEY: Array<{ key: string; label: string }> = [
  { key: "profile", label: "Skills and proof" },
  { key: "review", label: "SIIP review" },
  { key: "waiting", label: "Waiting list" },
  { key: "matched", label: "Matched" },
  { key: "internship", label: "Internship" },
  { key: "test", label: "SIIP test" },
  { key: "certified", label: "Certified" },
];

export interface JourneyInput {
  reviewStatus?: ProfileReviewStatus | null;
  appStatus?: ApplicationStatus | null;
  /** The SIIP test state, when known (see MySiipTest). */
  siipState?: string | null;
}

/** 0-based journey stage. */
export function journeyStage(j: JourneyInput): number {
  const app = j.appStatus;
  const testOpen = Boolean(j.siipState && !["LOCKED_INTERNSHIP", "LOCKED_REVIEW"].includes(j.siipState));
  if (app === "COMPLETED") return j.siipState === "PASSED" ? 6 : 5;
  if (app === "PLACED") return j.siipState === "PASSED" ? 6 : testOpen ? 5 : 4;
  if (app === "MATCHED") return 3;
  if (j.reviewStatus === "APPROVED") return 2;
  if (j.reviewStatus === "SUBMITTED" || j.reviewStatus === "CHANGES_REQUESTED") return 1;
  return 0;
}
