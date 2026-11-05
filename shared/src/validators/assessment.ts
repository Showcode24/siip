import { z } from "zod";
import { AssessmentType, AttemptStatus, QuestionType } from "../enums";
import { paginationQuery } from "../pagination";

const id = z.string().min(1).max(64);

export const assessmentListQuery = z.object({
  cohortId: id.optional(),
  type: z.enum(AssessmentType).optional(),
});

const assessmentFields = z.object({
  cohortId: id.nullish(),
  type: z.enum(AssessmentType),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).nullish(),
  timeLimitMinutes: z.number().int().min(1).max(480),
  passMark: z.number().int().min(0).max(100),
  maxAttempts: z.number().int().min(1).max(10),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  published: z.boolean(),
});

export const createAssessmentSchema = assessmentFields
  .partial({ shuffleQuestions: true, shuffleOptions: true, published: true, maxAttempts: true })
  .strict();
export const updateAssessmentSchema = assessmentFields.partial().strict();

const option = z.object({ text: z.string().trim().min(1).max(1000), isCorrect: z.boolean() });

const questionFields = z.object({
  type: z.enum(QuestionType),
  prompt: z.string().trim().min(3).max(5000),
  points: z.number().int().min(1).max(100).default(1),
  order: z.number().int().min(0).max(10_000).optional(),
  options: z.array(option).max(10).default([]),
  acceptedAnswers: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
});

/** Each question type needs a coherent answer key. */
export function questionProblem(q: z.infer<typeof questionFields>): string | null {
  const correct = q.options.filter((o) => o.isCorrect).length;
  if (q.type === "SHORT_TEXT") {
    if (q.options.length > 0) return "Short-text questions cannot have options";
    if (q.acceptedAnswers.length === 0) return "Add at least one accepted answer";
    return null;
  }
  if (q.acceptedAnswers.length > 0) return "Only short-text questions take accepted answers";
  if (q.options.length < 2) return "Add at least two options";
  if (q.type === "SINGLE_CHOICE" && correct !== 1)
    return "Single-choice questions need exactly one correct option";
  if (q.type === "MULTIPLE_CHOICE" && correct < 1) return "Mark at least one correct option";
  return null;
}

// PATCH replaces the whole question (options included) so the answer key stays consistent.
export const questionSchema = questionFields.strict().superRefine((q, ctx) => {
  const problem = questionProblem(q);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});
export type QuestionInput = z.infer<typeof questionSchema>;

export const attemptListQuery = paginationQuery.extend({
  graduateId: id.optional(),
  status: z.enum(AttemptStatus).optional(),
});

export const retakeSchema = z.object({
  graduateId: id,
  extraAttempts: z.number().int().min(1).max(5).default(1),
  reason: z.string().trim().max(500).optional(),
});

const answer = z.object({
  questionId: id,
  selectedOptionIds: z.array(id).max(10).default([]),
  textAnswer: z.string().max(2000).nullish(),
});
export type AnswerInput = z.infer<typeof answer>;

export const saveAnswersSchema = z.object({
  answers: z
    .array(answer)
    .max(200)
    .refine(
      (a) => new Set(a.map((x) => x.questionId)).size === a.length,
      "Each question can only be answered once",
    ),
});

export const submitAttemptSchema = saveAnswersSchema.partial();
