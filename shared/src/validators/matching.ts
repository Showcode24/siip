import { z } from "zod";
import { MatchStatus, PlacementStatus } from "../enums";
import { paginationQuery } from "../pagination";

const id = z.string().min(1).max(64);

export const suggestionsQuery = z.object({
  openingId: id,
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const proposeMatchSchema = z.object({ openingId: id, applicationId: id });

export const withdrawMatchSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export const matchListQuery = paginationQuery.extend({
  status: z.enum(MatchStatus).optional(),
  openingId: id.optional(),
});

export const acceptMatchSchema = z.object({
  startDate: z.coerce.date().optional(),
  supervisorId: id.optional(),
});

export const rejectMatchSchema = z.object({ reason: z.string().trim().min(3).max(1000) });

export const placementListQuery = paginationQuery.extend({
  status: z.enum(PlacementStatus).optional(),
  companyId: id.optional(),
  cohortId: id.optional(),
});

export const endPlacementSchema = z.object({ reason: z.string().trim().min(3).max(1000) });

export const assignSupervisorSchema = z.object({ supervisorId: id });
