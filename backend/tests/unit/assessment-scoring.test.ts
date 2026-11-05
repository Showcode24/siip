import { describe, expect, it } from "vitest";
import { scoreAttempt, shuffle, type ScoringQuestion } from "@/server/lib/assessment-scoring";
import { questionSchema } from "@/server/validators/assessment";

const questions: ScoringQuestion[] = [
  { id: "q1", type: "SINGLE_CHOICE", points: 1, correctOptionIds: ["a"], acceptedAnswers: [] },
  { id: "q2", type: "MULTIPLE_CHOICE", points: 2, correctOptionIds: ["x", "y"], acceptedAnswers: [] },
  { id: "q3", type: "SHORT_TEXT", points: 1, correctOptionIds: [], acceptedAnswers: ["Abuja"] },
];
const ans = (questionId: string, selectedOptionIds: string[] = [], textAnswer: string | null = null) => ({
  questionId,
  selectedOptionIds,
  textAnswer,
});

describe("scoreAttempt", () => {
  it("scores a perfect attempt 100% and passes", () => {
    const r = scoreAttempt(
      questions,
      [ans("q1", ["a"]), ans("q2", ["y", "x"]), ans("q3", [], "  abuja. ")],
      50,
    );
    expect(r).toMatchObject({ score: 4, maxScore: 4, percentage: 100, passed: true });
  });

  it("gives no partial credit on multiple choice", () => {
    const r = scoreAttempt(questions, [ans("q2", ["x"])], 0);
    expect(r.answers.find((a) => a.questionId === "q2")).toMatchObject({
      isCorrect: false,
      pointsAwarded: 0,
    });
    expect(scoreAttempt(questions, [ans("q2", ["x", "y", "z"])], 0).score).toBe(0);
  });

  it("rejects extra selections on single choice and scores unanswered as zero", () => {
    const r = scoreAttempt(questions, [ans("q1", ["a", "b"])], 50);
    expect(r).toMatchObject({ score: 0, percentage: 0, passed: false });
  });

  it("passes exactly at the pass mark", () => {
    const r = scoreAttempt(questions, [ans("q2", ["x", "y"])], 50);
    expect(r).toMatchObject({ percentage: 50, passed: true });
  });
});

describe("shuffle", () => {
  it("keeps every item", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(items).sort((a, b) => a - b)).toEqual(items);
  });
});

describe("questionSchema", () => {
  const base = { prompt: "Pick one", points: 1 };
  it("needs exactly one correct option for single choice", () => {
    const options = [
      { text: "A", isCorrect: true },
      { text: "B", isCorrect: true },
    ];
    expect(questionSchema.safeParse({ ...base, type: "SINGLE_CHOICE", options }).success).toBe(false);
  });
  it("needs accepted answers and no options for short text", () => {
    expect(questionSchema.safeParse({ ...base, type: "SHORT_TEXT" }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, type: "SHORT_TEXT", acceptedAnswers: ["x"] }).success).toBe(
      true,
    );
  });
});
