import type { ApplicationStatus, AssessmentType, AttemptStatus } from "@/generated/prisma/enums";
import { db, type Tx } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { env } from "@/server/env";
import { scoreAttempt, shuffle } from "@/server/lib/assessment-scoring";
import { errors } from "@/server/lib/errors";
import type { AnswerInput } from "@/server/validators/assessment";
import { sendApplicationEmail, transitionApplication, type ApplicationChange } from "./application.service";
import { findCurrentApplication } from "./enrolment";
import { siipGate } from "./siip-test.service";

/** Allowance for network latency on the last save/submit. The deadline itself is not extended. */
const GRACE_MS = 30_000;

/** The application stage at which each assessment type can be taken. */
const ELIGIBLE: Record<AssessmentType, ApplicationStatus[]> = {
  SCREENING: ["SUBMITTED", "SCREENING"],
  FINAL: ["FINAL_ASSESSMENT"],
  // The SIIP test isn't tied to an application stage: see siipGate.
  SIIP: [],
};

interface LayoutItem {
  questionId: string;
  optionIds: string[];
}

const isOverdue = (deadlineAt: Date, now = Date.now()) => now > deadlineAt.getTime() + GRACE_MS;

// ─── Listing and starting ─────────────────────────────────────────────────────

/** Assessments the graduate can see now, with their attempt history (no answer keys). */
export async function listMyAssessments(graduateId: string) {
  const app = await findCurrentApplication(graduateId);
  if (!app) return [];
  const assessments = await db.assessment.findMany({
    // The SIIP test has its own page and rules (siip-test.service).
    where: { published: true, type: { not: "SIIP" }, OR: [{ cohortId: app.cohortId }, { cohortId: null }] },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      timeLimitMinutes: true,
      passMark: true,
      maxAttempts: true,
      _count: { select: { questions: true } },
      attempts: {
        where: { graduateId },
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          percentage: true,
          passed: true,
          deadlineAt: true,
        },
        orderBy: { attemptNumber: "asc" },
      },
      retakeGrants: { where: { graduateId }, select: { extraAttempts: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return assessments.map(({ attempts, retakeGrants, _count, ...a }) => {
    const allowed = a.maxAttempts + (retakeGrants[0]?.extraAttempts ?? 0);
    const inProgress = attempts.find((t) => t.status === "IN_PROGRESS" && !isOverdue(t.deadlineAt));
    const passed = attempts.some((t) => t.passed);
    const eligible = ELIGIBLE[a.type].includes(app.status);
    return {
      ...a,
      questionCount: _count.questions,
      attemptsAllowed: allowed,
      attemptsUsed: attempts.length,
      passed,
      inProgressAttemptId: inProgress?.id ?? null,
      canStart: eligible && !passed && (Boolean(inProgress) || attempts.length < allowed),
      attempts: attempts.map(({ deadlineAt: _d, ...t }) => t),
    };
  });
}

/** Starts a new attempt, or resumes the one already in progress. */
export async function startAttempt(graduateId: string, assessmentId: string) {
  const followUps: FinalizeOutcome[] = [];
  const attemptId = await db.$transaction(async (tx) => {
    const assessment = await tx.assessment.findFirst({
      where: { id: assessmentId, published: true },
      include: {
        // Retired question versions stay for past attempts but never enter new ones.
        questions: {
          where: { archivedAt: null },
          orderBy: [{ order: "asc" }, { id: "asc" }],
          include: { options: true },
        },
      },
    });
    if (!assessment) throw errors.notFound("Assessment");
    const isSiip = assessment.type === "SIIP";
    if (!isSiip) {
      const app = await findCurrentApplication(graduateId, tx);
      if (!app || (assessment.cohortId && assessment.cohortId !== app.cohortId)) throw errors.notFound("Assessment");
      if (!ELIGIBLE[assessment.type].includes(app.status)) {
        throw errors.forbidden("This assessment is not available at your current stage");
      }
    }

    const open = await tx.attempt.findFirst({ where: { assessmentId, graduateId, status: "IN_PROGRESS" } });
    if (open) {
      if (!isOverdue(open.deadlineAt)) return open.id;
      const outcome = await finalizeAttempt(tx, open.id, "EXPIRED");
      if (outcome) followUps.push(outcome);
    }

    if (isSiip) {
      // Internship time, supervisor review, videos watched and the retake wait.
      const gate = await siipGate(tx, graduateId, assessment);
      if (gate.state === "PASSED") throw errors.conflict("You have already passed this assessment");
      if (gate.state !== "READY") throw errors.forbidden(gate.message);
    }

    const [previous, grant] = await Promise.all([
      tx.attempt.findMany({ where: { assessmentId, graduateId }, select: { passed: true } }),
      tx.retakeGrant.findUnique({ where: { assessmentId_graduateId: { assessmentId, graduateId } } }),
    ]);
    if (previous.some((p) => p.passed)) throw errors.conflict("You have already passed this assessment");
    // The SIIP test has no attempt limit, only the wait between attempts.
    if (!isSiip && previous.length >= assessment.maxAttempts + (grant?.extraAttempts ?? 0)) {
      throw errors.conflict("You have no attempts left for this assessment");
    }
    if (assessment.questions.length === 0) throw errors.badRequest("This assessment has no questions yet");

    const questions = assessment.shuffleQuestions ? shuffle(assessment.questions) : assessment.questions;
    const layout: LayoutItem[] = questions.map((q) => {
      const options = [...q.options].sort((a, b) => a.order - b.order);
      return {
        questionId: q.id,
        optionIds: (assessment.shuffleOptions ? shuffle(options) : options).map((o) => o.id),
      };
    });
    const now = new Date();
    // The (assessment, graduate, attemptNumber) unique key stops a double start.
    const attempt = await tx.attempt.create({
      data: {
        assessmentId,
        graduateId,
        attemptNumber: previous.length + 1,
        startedAt: now,
        deadlineAt: new Date(now.getTime() + assessment.timeLimitMinutes * 60_000),
        layout: layout as unknown as object,
      },
    });
    return attempt.id;
  });
  for (const outcome of followUps) await sendFinalizeEmails(outcome);
  return getMyAttempt(graduateId, attemptId);
}

// ─── Viewing, saving, submitting ──────────────────────────────────────────────

async function findOwnedAttempt(graduateId: string, attemptId: string, client: Tx | typeof db = db) {
  const attempt = await client.attempt.findFirst({ where: { id: attemptId, graduateId } });
  if (!attempt) throw errors.notFound("Attempt");
  return attempt;
}

/** Expires an overdue in-progress attempt. Returns true if it did. */
async function expireIfOverdue(attempt: { id: string; status: AttemptStatus; deadlineAt: Date }) {
  if (attempt.status !== "IN_PROGRESS" || !isOverdue(attempt.deadlineAt)) return false;
  const outcome = await db.$transaction((tx) => finalizeAttempt(tx, attempt.id, "EXPIRED"));
  if (outcome) await sendFinalizeEmails(outcome);
  return true;
}

/**
 * In progress: questions (in this attempt's order, no answer key), saved answers
 * and the server deadline. Finished: score and pass/fail only.
 */
export async function getMyAttempt(graduateId: string, attemptId: string) {
  let attempt = await findOwnedAttempt(graduateId, attemptId);
  if (await expireIfOverdue(attempt)) attempt = await findOwnedAttempt(graduateId, attemptId);

  const assessment = await db.assessment.findUniqueOrThrow({
    where: { id: attempt.assessmentId },
    select: { id: true, title: true, type: true, passMark: true, timeLimitMinutes: true },
  });
  const base = {
    id: attempt.id,
    assessment,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
  };
  if (attempt.status !== "IN_PROGRESS") {
    return {
      ...base,
      submittedAt: attempt.submittedAt,
      result: { percentage: attempt.percentage, passed: attempt.passed },
    };
  }

  const layout = attempt.layout as unknown as LayoutItem[];
  const [questions, saved] = await Promise.all([
    db.question.findMany({
      where: { id: { in: layout.map((l) => l.questionId) } },
      // isCorrect and acceptedAnswers are deliberately not selected.
      select: {
        id: true,
        type: true,
        prompt: true,
        points: true,
        options: { select: { id: true, text: true } },
      },
    }),
    db.attemptAnswer.findMany({
      where: { attemptId },
      select: { questionId: true, selectedOptionIds: true, textAnswer: true },
    }),
  ]);
  const byId = new Map(questions.map((q) => [q.id, q]));
  return {
    ...base,
    serverTime: new Date(),
    questions: layout.flatMap((item) => {
      const q = byId.get(item.questionId);
      if (!q) return [];
      const options = new Map(q.options.map((o) => [o.id, o]));
      return [{ ...q, options: item.optionIds.flatMap((id) => options.get(id) ?? []) }];
    }),
    answers: saved,
  };
}

/** Validates answers against this attempt's questions and stores them. */
async function storeAnswers(tx: Tx, attemptId: string, layout: LayoutItem[], answers: AnswerInput[]) {
  const allowed = new Map(layout.map((l) => [l.questionId, l.optionIds]));
  const types = new Map(
    (
      await tx.question.findMany({
        where: { id: { in: answers.map((a) => a.questionId) } },
        select: { id: true, type: true },
      })
    ).map((q) => [q.id, q.type]),
  );
  for (const a of answers) {
    const optionIds = allowed.get(a.questionId);
    const type = types.get(a.questionId);
    if (!optionIds || !type) throw errors.badRequest("An answer refers to a question not in this attempt");
    const selected = [...new Set(a.selectedOptionIds)];
    if (selected.some((id) => !optionIds.includes(id)))
      throw errors.badRequest("An answer has an invalid option");
    if (type === "SINGLE_CHOICE" && selected.length > 1) {
      throw errors.badRequest("Single-choice questions take one option");
    }
    const data = {
      selectedOptionIds: type === "SHORT_TEXT" ? [] : selected,
      textAnswer: type === "SHORT_TEXT" ? (a.textAnswer?.trim() ?? null) : null,
    };
    await tx.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: a.questionId } },
      update: data,
      create: { attemptId, questionId: a.questionId, ...data },
    });
  }
}

export async function saveAnswers(graduateId: string, attemptId: string, answers: AnswerInput[]) {
  const attempt = await findOwnedAttempt(graduateId, attemptId);
  if (attempt.status !== "IN_PROGRESS") throw errors.conflict("This attempt has already ended");
  if (await expireIfOverdue(attempt)) {
    throw errors.conflict("Time is up. Your saved answers have been submitted.");
  }
  await db.$transaction(async (tx) => {
    // Re-check inside the transaction so a concurrent submit can't be overwritten.
    const fresh = await tx.attempt.findUniqueOrThrow({ where: { id: attemptId }, select: { status: true } });
    if (fresh.status !== "IN_PROGRESS") throw errors.conflict("This attempt has already ended");
    await storeAnswers(tx, attemptId, attempt.layout as unknown as LayoutItem[], answers);
  });
  return { saved: answers.length, deadlineAt: attempt.deadlineAt };
}

/** Submits (idempotent). Answers sent after the deadline are ignored and the attempt is marked EXPIRED. */
export async function submitAttempt(graduateId: string, attemptId: string, answers: AnswerInput[] = []) {
  const attempt = await findOwnedAttempt(graduateId, attemptId);
  if (attempt.status === "IN_PROGRESS") {
    const overdue = isOverdue(attempt.deadlineAt);
    const outcome = await db.$transaction(async (tx) => {
      if (!overdue && answers.length > 0) {
        await storeAnswers(tx, attemptId, attempt.layout as unknown as LayoutItem[], answers);
      }
      return finalizeAttempt(tx, attemptId, overdue ? "EXPIRED" : "SUBMITTED");
    });
    if (outcome) await sendFinalizeEmails(outcome);
  }
  return getMyAttempt(graduateId, attemptId);
}

// ─── Scoring and its consequences ─────────────────────────────────────────────

interface FinalizeOutcome {
  attemptId: string;
  assessmentTitle: string;
  percentage: number;
  passed: boolean;
  recipient: { userId: string; email: string; firstName: string; deleted: boolean };
  applicationChange: ApplicationChange | null;
}

/**
 * Scores the attempt on the server and closes it. Returns null if another
 * request closed it first. A passed FINAL qualifies the graduate; a SCREENING
 * attempt moves a new application into screening.
 */
async function finalizeAttempt(tx: Tx, attemptId: string, status: "SUBMITTED" | "EXPIRED") {
  const attempt = await tx.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      assessment: {
        select: {
          title: true,
          type: true,
          passMark: true,
          questions: {
            select: {
              id: true,
              type: true,
              points: true,
              acceptedAnswers: true,
              options: { where: { isCorrect: true }, select: { id: true } },
            },
          },
        },
      },
      answers: { select: { questionId: true, selectedOptionIds: true, textAnswer: true } },
      graduate: { select: { firstName: true, user: { select: { id: true, email: true, deletedAt: true } } } },
    },
  });
  const layoutIds = new Set((attempt.layout as unknown as LayoutItem[]).map((l) => l.questionId));
  const questions = attempt.assessment.questions
    .filter((q) => layoutIds.has(q.id))
    .map((q) => ({ ...q, correctOptionIds: q.options.map((o) => o.id) }));
  const result = scoreAttempt(questions, attempt.answers, attempt.assessment.passMark);

  // Guarded on IN_PROGRESS: exactly one request gets to close the attempt.
  const { count } = await tx.attempt.updateMany({
    where: { id: attemptId, status: "IN_PROGRESS" },
    data: {
      status,
      submittedAt: new Date(),
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      passed: result.passed,
    },
  });
  if (count === 0) return null;
  for (const a of result.answers) {
    await tx.attemptAnswer.updateMany({
      where: { attemptId, questionId: a.questionId },
      data: { isCorrect: a.isCorrect, pointsAwarded: a.pointsAwarded },
    });
  }

  const applicationChange = await advanceApplication(
    tx,
    attempt.graduateId,
    attempt.assessment.type,
    result.passed,
  );
  return {
    attemptId,
    assessmentTitle: attempt.assessment.title,
    percentage: result.percentage,
    passed: result.passed,
    recipient: {
      userId: attempt.graduate.user.id,
      email: attempt.graduate.user.email,
      firstName: attempt.graduate.firstName,
      deleted: Boolean(attempt.graduate.user.deletedAt),
    },
    applicationChange,
  } satisfies FinalizeOutcome;
}

async function advanceApplication(tx: Tx, graduateId: string, type: AssessmentType, passed: boolean) {
  const app = await findCurrentApplication(graduateId, tx);
  if (!app) return null;
  const to: ApplicationStatus | null =
    type === "FINAL" && passed && app.status === "FINAL_ASSESSMENT"
      ? "QUALIFIED"
      : type === "SCREENING" && app.status === "SUBMITTED"
        ? "SCREENING"
        : null;
  if (!to) return null;
  return transitionApplication(tx, { applicationId: app.id, to, actor: "SYSTEM", auditActor: null });
}

async function sendFinalizeEmails(outcome: FinalizeOutcome) {
  if (!outcome.recipient.deleted) {
    await sendEmail({
      template: "assessment-result",
      to: outcome.recipient.email,
      toUserId: outcome.recipient.userId,
      idempotencyKey: `assessment-result:${outcome.attemptId}`,
      props: {
        firstName: outcome.recipient.firstName,
        assessmentTitle: outcome.assessmentTitle,
        percentage: outcome.percentage,
        passed: outcome.passed,
        dashboardUrl: `${env().APP_URL}/dashboard/assessments`,
      },
    });
  }
  if (outcome.applicationChange) await sendApplicationEmail(outcome.applicationChange);
}

/** Closes and scores attempts whose time ran out without a submit. Used by the daily cron. */
export async function expireOverdueAttempts(now = new Date()) {
  const overdue = await db.attempt.findMany({
    where: { status: "IN_PROGRESS", deadlineAt: { lt: new Date(now.getTime() - GRACE_MS) } },
    select: { id: true },
    take: 500,
  });
  let expired = 0;
  for (const { id } of overdue) {
    const outcome = await db.$transaction((tx) => finalizeAttempt(tx, id, "EXPIRED"));
    if (outcome) {
      expired++;
      await sendFinalizeEmails(outcome);
    }
  }
  return expired;
}
