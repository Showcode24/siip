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
  // SIIP test settings.
  retakeAfterHours: z.number().int().min(0).max(720),
  unlockAfterWeeks: z.number().int().min(0).max(52),
  minCheckInRating: z.number().int().min(1).max(5),
});

export const createAssessmentSchema = assessmentFields
  .partial({
    shuffleQuestions: true,
    shuffleOptions: true,
    published: true,
    maxAttempts: true,
    retakeAfterHours: true,
    unlockAfterWeeks: true,
    minCheckInRating: true,
  })
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
  // SIIP test: the video this question is about.
  videoId: id.nullish(),
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

// ─── SIIP test videos ─────────────────────────────────────────────────────────

/**
 * The 11-character video id from any usual YouTube link (watch, youtu.be,
 * shorts, embed), or null if it isn't one.
 */
export function youtubeIdFrom(input: string): string | null {
  const v = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? /^\/(?:embed|shorts|live)\/([^/?]+)/.exec(url.pathname)?.[1] ?? null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

const youtubeLink = z
  .string()
  .trim()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const id = youtubeIdFrom(v);
    if (!id) {
      ctx.addIssue({ code: "custom", message: "Paste a YouTube link, e.g. https://www.youtube.com/watch?v=..." });
      return z.NEVER;
    }
    return id;
  });

export const testVideoSchema = z
  .object({
    title: z.string().trim().min(3, "Give the video a title").max(160),
    description: z.string().trim().max(500).nullish(),
    /** Any YouTube link; stored as its video id. Leave empty for a placeholder. */
    youtubeUrl: youtubeLink,
  })
  .strict();
export const updateTestVideoSchema = testVideoSchema.partial().strict();

export const reorderVideosSchema = z.object({
  ids: z.array(id).min(1).max(30),
});
