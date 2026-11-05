// Allowed status moves, mirrored from backend/src/server/lib/state-machine.ts so the
// UI only offers valid actions. The backend still enforces them.
import type { ApplicationStatus, CohortStatus, CompanyVerificationStatus } from "@siip/shared/enums";

export const COHORT_NEXT: Record<CohortStatus, Array<{ to: CohortStatus; label: string }>> = {
  DRAFT: [{ to: "APPLICATIONS_OPEN", label: "Open applications" }],
  APPLICATIONS_OPEN: [{ to: "APPLICATIONS_CLOSED", label: "Close applications" }],
  APPLICATIONS_CLOSED: [
    { to: "APPLICATIONS_OPEN", label: "Reopen applications" },
    { to: "IN_PROGRESS", label: "Start the cohort" },
  ],
  IN_PROGRESS: [{ to: "COMPLETED", label: "Mark completed" }],
  COMPLETED: [{ to: "ARCHIVED", label: "Archive" }],
  ARCHIVED: [],
};

export const COMPANY_NEXT: Record<
  CompanyVerificationStatus,
  Array<{
    to: CompanyVerificationStatus;
    label: string;
    needsReason?: boolean;
    tone: "primary" | "outline" | "danger";
  }>
> = {
  PENDING: [
    { to: "VERIFIED", label: "Verify", tone: "primary" },
    { to: "REJECTED", label: "Reject", needsReason: true, tone: "danger" },
  ],
  VERIFIED: [{ to: "SUSPENDED", label: "Suspend", needsReason: true, tone: "danger" }],
  SUSPENDED: [{ to: "VERIFIED", label: "Reinstate", tone: "primary" }],
  REJECTED: [],
};

/** Statuses an admin can set by hand (MATCHED/PLACED/COMPLETED are set by the system). */
export const ADMIN_SETTABLE: ApplicationStatus[] = [
  "SCREENING",
  "SHORTLISTED",
  "IN_TRAINING",
  "FINAL_ASSESSMENT",
  "QUALIFIED",
  "REJECTED",
];
