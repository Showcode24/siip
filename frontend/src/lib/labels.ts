// Human labels and status tones for every backend enum, in one place.
import type {
  ApplicationStatus,
  Availability,
  CohortStatus,
  CompanyVerificationStatus,
  DegreeClass,
  InternType,
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
  QUALIFIED: { label: "Qualified", tone: "success" },
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

export const WORK_MODE: Record<WorkMode, string> = { ONSITE: "On-site", REMOTE: "Remote", HYBRID: "Hybrid" };

export const INTERN_TYPE: Record<InternType, { label: string; hint: string }> = {
  NYSC_CORPS_MEMBER: { label: "NYSC corps member", hint: "Currently serving" },
  UNDERGRADUATE: { label: "Undergraduate", hint: "Still studying" },
  GRADUATE: { label: "Graduate", hint: "Finished your studies" },
};

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
export const JOURNEY: Array<{ key: string; label: string; statuses: ApplicationStatus[] }> = [
  { key: "register", label: "Register", statuses: ["SUBMITTED"] },
  { key: "screening", label: "Screening", statuses: ["SCREENING", "SHORTLISTED"] },
  { key: "training", label: "Training", statuses: ["IN_TRAINING"] },
  { key: "assessment", label: "Final assessment", statuses: ["FINAL_ASSESSMENT"] },
  { key: "matching", label: "Matching", statuses: ["QUALIFIED", "MATCHED"] },
  { key: "internship", label: "Internship", statuses: ["PLACED"] },
  { key: "certified", label: "Certified", statuses: ["COMPLETED"] },
];

/** 0-based journey stage for an application status (-1 if the journey has ended early). */
export function journeyStage(status: ApplicationStatus | null | undefined): number {
  if (!status) return 0;
  if (status === "REJECTED" || status === "WITHDRAWN") return -1;
  return JOURNEY.findIndex((s) => s.statuses.includes(status));
}
