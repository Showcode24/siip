import { randomInt } from "node:crypto";
import type { QuestionType } from "@/generated/prisma/enums";

export interface ScoringQuestion {
  id: string;
  type: QuestionType;
  points: number;
  correctOptionIds: string[];
  acceptedAnswers: string[];
}

export interface GivenAnswer {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer: string | null;
}

export interface ScoredAnswer {
  questionId: string;
  isCorrect: boolean;
  pointsAwarded: number;
}

export interface ScoreResult {
  answers: ScoredAnswer[];
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
}

/** Case-, whitespace- and trailing-punctuation-insensitive comparison for short text. */
export function normaliseText(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Whether one answer is correct. Multiple choice is all-or-nothing (exact set match). */
export function isAnswerCorrect(q: ScoringQuestion, a: GivenAnswer | undefined): boolean {
  if (!a) return false;
  switch (q.type) {
    case "SINGLE_CHOICE":
      return a.selectedOptionIds.length === 1 && q.correctOptionIds.includes(a.selectedOptionIds[0]);
    case "MULTIPLE_CHOICE":
      return sameSet([...new Set(a.selectedOptionIds)], q.correctOptionIds);
    case "SHORT_TEXT": {
      if (!a.textAnswer) return false;
      const given = normaliseText(a.textAnswer);
      return q.acceptedAnswers.some((accepted) => normaliseText(accepted) === given);
    }
  }
}

/** Scores an attempt. Unanswered questions score zero. */
export function scoreAttempt(
  questions: ScoringQuestion[],
  given: GivenAnswer[],
  passMark: number,
): ScoreResult {
  const byQuestion = new Map(given.map((a) => [a.questionId, a]));
  const answers = questions.map((q) => {
    const isCorrect = isAnswerCorrect(q, byQuestion.get(q.id));
    return { questionId: q.id, isCorrect, pointsAwarded: isCorrect ? q.points : 0 };
  });
  const score = answers.reduce((sum, a) => sum + a.pointsAwarded, 0);
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
  const percentage = maxScore === 0 ? 0 : Math.round((score / maxScore) * 10_000) / 100;
  return { answers, score, maxScore, percentage, passed: percentage >= passMark };
}

/** Fisher-Yates with a CSPRNG, so the order can't be predicted from Math.random. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
