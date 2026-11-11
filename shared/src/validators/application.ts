import { z } from "zod";
import { ApplicationStatus, NyscStatus, InternType } from "../enums";
import { COUNTRY_CODES } from "../countries";
import { NIGERIAN_STATES } from "../nigeria";
import { paginationQuery } from "../pagination";
import { listParam } from "./common";

export const applySchema = z.object({
  cohortId: z.string().min(1).max(64),
  motivation: z.string().trim().max(2000).optional(),
});
export type ApplyInput = z.infer<typeof applySchema>;

export const withdrawSchema = z.object({ reason: z.string().trim().max(500).optional() });

const id = z.string().min(1).max(64);

export const adminApplicationListQuery = paginationQuery.extend({
  cohortId: id.optional(),
  status: listParam(z.enum(ApplicationStatus)),
  state: z.enum(NIGERIAN_STATES).optional(),
  skillId: id.optional(),
  institution: z.string().trim().min(2).max(160).optional(),
  nyscStatus: z.enum(NyscStatus).optional(),
  internType: z.enum(InternType).optional(),
  country: z.enum(COUNTRY_CODES).optional(),
  sort: z.enum(["newest", "oldest", "recently_updated"]).default("newest"),
});
export type AdminApplicationListQuery = z.infer<typeof adminApplicationListQuery>;

const statusChange = {
  status: z.enum(ApplicationStatus),
  /** Shown to the graduate (e.g. why they were not selected). Required for REJECTED. */
  reason: z.string().trim().min(3).max(1000).optional(),
  /** Internal screening note; never shown to the graduate. */
  note: z.string().trim().min(1).max(5000).optional(),
};

export const changeStatusSchema = z.object(statusChange);
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export const bulkChangeStatusSchema = z.object({
  ...statusChange,
  applicationIds: z
    .array(id)
    .min(1)
    .max(100, "Update at most 100 applications at a time")
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate application ids"),
});

export const addNoteSchema = z.object({ body: z.string().trim().min(1).max(5000) });
