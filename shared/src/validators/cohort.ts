import { z } from "zod";
import { CohortStatus } from "../enums";

const date = z.coerce.date();

const cohortFields = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).nullish(),
  applicationOpensAt: date,
  applicationClosesAt: date,
  trainingStartsAt: date,
  trainingEndsAt: date,
  internshipStartsAt: date,
  internshipEndsAt: date,
  capacity: z.number().int().min(1).max(100_000),
});

export const createCohortSchema = cohortFields.strict();
export type CreateCohortInput = z.infer<typeof createCohortSchema>;

export const updateCohortSchema = cohortFields.partial().strict();
export type UpdateCohortInput = z.infer<typeof updateCohortSchema>;

export const cohortStatusSchema = z.object({ status: z.enum(CohortStatus) });

export type CohortDates = Pick<
  CreateCohortInput,
  | "applicationOpensAt"
  | "applicationClosesAt"
  | "trainingStartsAt"
  | "trainingEndsAt"
  | "internshipStartsAt"
  | "internshipEndsAt"
>;

/** Returns a message for the first out-of-order date pair, or null if the timeline is valid. */
export function cohortDateProblem(d: CohortDates): string | null {
  const rules: Array<[Date, Date, string, boolean]> = [
    [d.applicationOpensAt, d.applicationClosesAt, "Applications must open before they close", true],
    [d.applicationClosesAt, d.trainingStartsAt, "Training must start after applications close", false],
    [d.trainingStartsAt, d.trainingEndsAt, "Training must start before it ends", true],
    [d.trainingEndsAt, d.internshipStartsAt, "The internship must start after training ends", false],
    [d.internshipStartsAt, d.internshipEndsAt, "The internship must start before it ends", true],
  ];
  for (const [earlier, later, message, strict] of rules) {
    const bad = strict ? earlier >= later : earlier > later;
    if (bad) return message;
  }
  return null;
}
