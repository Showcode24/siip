import { z } from "zod";

export const checkInSchema = z.object({
  month: z.number().int().min(1).max(3),
  progressNote: z.string().trim().min(10).max(3000),
  challenges: z.string().trim().max(2000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

const area = z.number().int().min(1).max(5);

export const evaluationSchema = z.object({
  punctuality: area,
  skill: area,
  communication: area,
  teamwork: area,
  initiative: area,
  comments: z.string().trim().max(3000).optional(),
  wouldHire: z.boolean(),
});
export type EvaluationInput = z.infer<typeof evaluationSchema>;

export const permanentOfferSchema = z.object({
  offeredAt: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const programmeEvaluationSchema = z.object({
  notes: z.string().trim().max(3000).optional(),
  approvedForCertificate: z.boolean(),
});

export const verificationCodeParam = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{6,20}$/),
});
