import { z } from "zod";
import { ApplicationStatus, PlacementStatus } from "../enums";
import { listParam } from "./common";

const id = z.string().min(1).max(64);

export const analyticsQuery = z.object({ cohortId: id.optional() });

export const applicationExportQuery = z.object({
  cohortId: id.optional(),
  status: listParam(z.enum(ApplicationStatus)),
});

export const placementExportQuery = z.object({
  cohortId: id.optional(),
  companyId: id.optional(),
  status: z.enum(PlacementStatus).optional(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirm: z.literal("DELETE", { error: 'Type "DELETE" to confirm' }),
});
