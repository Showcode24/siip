import type {
  ApplicationStatus,
  CohortStatus,
  CompanyVerificationStatus,
  MatchStatus,
  OpeningStatus,
  PlacementStatus,
} from "@/generated/prisma/enums";
import { AppError } from "./errors";

/** Who is asking for a transition. SYSTEM = another service or a cron job. */
export type Actor = "ADMIN" | "GRADUATE" | "COMPANY" | "SYSTEM";

type TransitionTable<S extends string> = Record<S, Partial<Record<S, readonly Actor[]>>>;

export interface StateMachine<S extends string> {
  readonly name: string;
  can(from: S, to: S, actor: Actor): boolean;
  /** Throws INVALID_TRANSITION (409) if the move is not allowed for this actor. */
  assert(from: S, to: S, actor: Actor): void;
  nextStates(from: S, actor: Actor): S[];
  isTerminal(state: S): boolean;
}

export function createStateMachine<S extends string>(
  name: string,
  table: TransitionTable<S>,
): StateMachine<S> {
  const can = (from: S, to: S, actor: Actor) => table[from]?.[to]?.includes(actor) ?? false;
  return {
    name,
    can,
    assert(from, to, actor) {
      if (!can(from, to, actor)) {
        throw new AppError("INVALID_TRANSITION", `${name} cannot move from ${from} to ${to}`, {
          from,
          to,
        });
      }
    },
    nextStates(from, actor) {
      return (Object.keys(table[from] ?? {}) as S[]).filter((to) => can(from, to, actor));
    },
    isTerminal(state) {
      return Object.keys(table[state] ?? {}).length === 0;
    },
  };
}

const A = ["ADMIN"] as const;
const S = ["SYSTEM"] as const;
const AS = ["ADMIN", "SYSTEM"] as const;
const AG = ["ADMIN", "GRADUATE"] as const;

// MATCHED/PLACED/COMPLETED are driven by the matching & placement services (SYSTEM),
// never set by hand, so the application can't drift from its Match/Placement rows.
export const applicationMachine = createStateMachine<ApplicationStatus>("Application", {
  // Cohorts and training are retired: when SIIP approves the profile, an application
  // still in the old steps moves straight to the waiting list (QUALIFIED) by SYSTEM.
  SUBMITTED: { SCREENING: AS, QUALIFIED: S, REJECTED: A, WITHDRAWN: AG },
  SCREENING: { SHORTLISTED: A, QUALIFIED: S, REJECTED: A, WITHDRAWN: AG },
  SHORTLISTED: { IN_TRAINING: AS, QUALIFIED: S, REJECTED: A, WITHDRAWN: AG },
  IN_TRAINING: { FINAL_ASSESSMENT: AS, QUALIFIED: S, REJECTED: A, WITHDRAWN: AG },
  FINAL_ASSESSMENT: { QUALIFIED: AS, REJECTED: AS, WITHDRAWN: AG },
  QUALIFIED: { MATCHED: S, WITHDRAWN: AG },
  // Back to QUALIFIED when the company rejects or the admin withdraws the match.
  MATCHED: { PLACED: S, QUALIFIED: S, WITHDRAWN: AG },
  PLACED: { COMPLETED: S },
  COMPLETED: {},
  REJECTED: {},
  WITHDRAWN: {},
});

export const placementMachine = createStateMachine<PlacementStatus>("Placement", {
  ACTIVE: { COMPLETED: AS, TERMINATED: A },
  COMPLETED: {},
  TERMINATED: {},
});

export const companyMachine = createStateMachine<CompanyVerificationStatus>("Company", {
  PENDING: { VERIFIED: A, REJECTED: A },
  VERIFIED: { SUSPENDED: A },
  SUSPENDED: { VERIFIED: A },
  // A rejected company may fix its details and resubmit.
  REJECTED: { PENDING: ["COMPANY"] },
});

export const matchMachine = createStateMachine<MatchStatus>("Match", {
  PROPOSED: { COMPANY_ACCEPTED: ["COMPANY"], COMPANY_REJECTED: ["COMPANY"], WITHDRAWN: AS },
  COMPANY_ACCEPTED: {},
  COMPANY_REJECTED: {},
  WITHDRAWN: {},
});

export const cohortMachine = createStateMachine<CohortStatus>("Cohort", {
  DRAFT: { APPLICATIONS_OPEN: A },
  APPLICATIONS_OPEN: { APPLICATIONS_CLOSED: AS },
  APPLICATIONS_CLOSED: { APPLICATIONS_OPEN: A, IN_PROGRESS: A },
  IN_PROGRESS: { COMPLETED: A },
  COMPLETED: { ARCHIVED: A },
  ARCHIVED: {},
});

const AC = ["ADMIN", "COMPANY"] as const;

export const openingMachine = createStateMachine<OpeningStatus>("Opening", {
  DRAFT: { OPEN: AC, CLOSED: AC },
  OPEN: { CLOSED: [...AC, "SYSTEM"] },
  CLOSED: { OPEN: AC },
});
