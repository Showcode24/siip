import { z } from "zod";
import { SkillLevel } from "../enums";
import { paginationQuery } from "../pagination";

/** Lowest to highest. SIIP can confirm a claimed level or a lower one, never a higher one. */
export const SKILL_LEVEL_ORDER = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const satisfies readonly SkillLevel[];
export const levelRank = (l: SkillLevel) => SKILL_LEVEL_ORDER.indexOf(l);

/** Days between removing a profile and deleting it for good (it can be reopened until then). */
export const REMOVAL_GRACE_DAYS = 30;

/**
 * WAITING: sent for review, or approved with a newly added skill to check.
 * The others list profiles by where they stand.
 */
export const REVIEW_QUEUES = ["WAITING", "CHANGES_REQUESTED", "APPROVED", "REMOVED"] as const;
export type ReviewQueue = (typeof REVIEW_QUEUES)[number];

export const reviewQueueQuery = paginationQuery.extend({
  queue: z.enum(REVIEW_QUEUES).default("WAITING"),
  q: z.string().trim().min(2).max(100).optional(),
});

const reason = (what: string) =>
  z.string().trim().min(10, `Give the intern a clear ${what} (at least 10 characters)`).max(1000);

/** One skill: confirm it at the claimed level or a lower one, or reject it with a reason. */
export const skillDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("VERIFY"), level: z.enum(SkillLevel) }).strict(),
  z.object({ decision: z.literal("REJECT"), reason: reason("reason") }).strict(),
]);
export type SkillDecisionInput = z.infer<typeof skillDecisionSchema>;

/** The whole profile. */
export const profileDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("APPROVE") }).strict(),
  z.object({ action: z.literal("REQUEST_CHANGES"), note: reason("note about what to add") }).strict(),
  z.object({ action: z.literal("REMOVE"), reason: reason("reason") }).strict(),
  z.object({ action: z.literal("RESTORE"), note: reason("note about what to fix") }).strict(),
]);
export type ProfileDecisionInput = z.infer<typeof profileDecisionSchema>;
