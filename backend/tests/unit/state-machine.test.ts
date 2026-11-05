import { describe, expect, it } from "vitest";
import { AppError } from "@/server/lib/errors";
import {
  applicationMachine,
  cohortMachine,
  companyMachine,
  matchMachine,
  placementMachine,
} from "@/server/lib/state-machine";

describe("applicationMachine", () => {
  it("allows the admin to walk the happy path up to QUALIFIED", () => {
    const path = [
      "SUBMITTED",
      "SCREENING",
      "SHORTLISTED",
      "IN_TRAINING",
      "FINAL_ASSESSMENT",
      "QUALIFIED",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(applicationMachine.can(path[i], path[i + 1], "ADMIN")).toBe(true);
    }
  });

  it("reserves MATCHED, PLACED and COMPLETED for the system", () => {
    expect(applicationMachine.can("QUALIFIED", "MATCHED", "ADMIN")).toBe(false);
    expect(applicationMachine.can("QUALIFIED", "MATCHED", "SYSTEM")).toBe(true);
    expect(applicationMachine.can("MATCHED", "PLACED", "ADMIN")).toBe(false);
    expect(applicationMachine.can("PLACED", "COMPLETED", "SYSTEM")).toBe(true);
  });

  it("returns a MATCHED application to QUALIFIED when a match falls through", () => {
    expect(applicationMachine.can("MATCHED", "QUALIFIED", "SYSTEM")).toBe(true);
  });

  it("lets a graduate only withdraw", () => {
    expect(applicationMachine.nextStates("SUBMITTED", "GRADUATE")).toEqual(["WITHDRAWN"]);
    expect(applicationMachine.can("SUBMITTED", "SCREENING", "GRADUATE")).toBe(false);
  });

  it("rejects skipping stages", () => {
    expect(applicationMachine.can("SUBMITTED", "QUALIFIED", "ADMIN")).toBe(false);
    expect(() => applicationMachine.assert("SUBMITTED", "QUALIFIED", "ADMIN")).toThrow(AppError);
  });

  it("treats COMPLETED, REJECTED and WITHDRAWN as terminal", () => {
    for (const s of ["COMPLETED", "REJECTED", "WITHDRAWN"] as const) {
      expect(applicationMachine.isTerminal(s)).toBe(true);
    }
    expect(applicationMachine.isTerminal("SUBMITTED")).toBe(false);
  });

  it("throws a 409 INVALID_TRANSITION error", () => {
    try {
      applicationMachine.assert("REJECTED", "SCREENING", "ADMIN");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("INVALID_TRANSITION");
      expect((err as AppError).status).toBe(409);
    }
  });
});

describe("other machines", () => {
  it("placement: only admins terminate; completed is final", () => {
    expect(placementMachine.can("ACTIVE", "TERMINATED", "ADMIN")).toBe(true);
    expect(placementMachine.can("ACTIVE", "TERMINATED", "COMPANY")).toBe(false);
    expect(placementMachine.isTerminal("COMPLETED")).toBe(true);
  });

  it("company: verify, suspend, reinstate; rejected companies may resubmit", () => {
    expect(companyMachine.can("PENDING", "VERIFIED", "ADMIN")).toBe(true);
    expect(companyMachine.can("VERIFIED", "SUSPENDED", "ADMIN")).toBe(true);
    expect(companyMachine.can("SUSPENDED", "VERIFIED", "ADMIN")).toBe(true);
    expect(companyMachine.can("REJECTED", "PENDING", "COMPANY")).toBe(true);
    expect(companyMachine.can("PENDING", "VERIFIED", "COMPANY")).toBe(false);
  });

  it("match: only the company accepts or rejects", () => {
    expect(matchMachine.can("PROPOSED", "COMPANY_ACCEPTED", "COMPANY")).toBe(true);
    expect(matchMachine.can("PROPOSED", "COMPANY_ACCEPTED", "ADMIN")).toBe(false);
    expect(matchMachine.can("COMPANY_ACCEPTED", "WITHDRAWN", "ADMIN")).toBe(false);
  });

  it("cohort: the cron job may close applications but not open them", () => {
    expect(cohortMachine.can("APPLICATIONS_OPEN", "APPLICATIONS_CLOSED", "SYSTEM")).toBe(true);
    expect(cohortMachine.can("DRAFT", "APPLICATIONS_OPEN", "SYSTEM")).toBe(false);
  });
});
