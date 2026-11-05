import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import { cursorArgs, toPage } from "@/server/lib/pagination";
import type {
  assessmentListQuery,
  attemptListQuery,
  createAssessmentSchema,
  QuestionInput,
  retakeSchema,
  updateAssessmentSchema,
} from "@/server/validators/assessment";

type In<S extends z.ZodType> = z.infer<S>;

export function listAssessments(query: In<typeof assessmentListQuery>) {
  return db.assessment.findMany({
    where: {
      ...(query.cohortId ? { cohortId: query.cohortId } : {}),
      ...(query.type ? { type: query.type } : {}),
    },
    include: { _count: { select: { questions: true, attempts: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

/** Admin view, answer key included. Never return this to graduates. */
export async function getAssessmentForAdmin(id: string) {
  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!assessment) throw errors.notFound("Assessment");
  return assessment;
}

/** Once anyone has attempted, the answer key is frozen so scores stay comparable. */
async function assertNoAttempts(tx: Tx, assessmentId: string) {
  const attempts = await tx.attempt.count({ where: { assessmentId } });
  if (attempts > 0) {
    throw errors.conflict("This assessment already has attempts, so its questions can no longer change");
  }
}

async function assertPublishable(tx: Tx, assessmentId: string) {
  const questions = await tx.question.count({ where: { assessmentId } });
  if (questions === 0) throw errors.badRequest("Add at least one question before publishing");
}

export async function createAssessment(actor: AuditActor, input: In<typeof createAssessmentSchema>) {
  if (input.published) throw errors.badRequest("Add questions before publishing");
  return db.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({ data: input });
    await recordAudit(tx, {
      actor,
      action: "assessment.created",
      entityType: "Assessment",
      entityId: assessment.id,
      after: { type: assessment.type, title: assessment.title },
    });
    return assessment;
  });
}

export async function updateAssessment(
  actor: AuditActor,
  id: string,
  input: In<typeof updateAssessmentSchema>,
) {
  return db.$transaction(async (tx) => {
    const before = await tx.assessment.findUnique({ where: { id } });
    if (!before) throw errors.notFound("Assessment");
    // Scoring rules are part of the answer key; settings like the title can still change.
    if (input.passMark !== undefined && input.passMark !== before.passMark) await assertNoAttempts(tx, id);
    if (input.type !== undefined && input.type !== before.type) await assertNoAttempts(tx, id);
    if (input.published) await assertPublishable(tx, id);

    const after = await tx.assessment.update({ where: { id }, data: input });
    const keys = Object.keys(input) as Array<keyof typeof input>;
    await recordAudit(tx, {
      actor,
      action: "assessment.updated",
      entityType: "Assessment",
      entityId: id,
      before: JSON.parse(JSON.stringify(Object.fromEntries(keys.map((k) => [k, before[k]])))),
      after: JSON.parse(JSON.stringify(Object.fromEntries(keys.map((k) => [k, after[k]])))),
    });
    return after;
  });
}

export async function deleteAssessment(actor: AuditActor, id: string) {
  await db.$transaction(async (tx) => {
    await assertNoAttempts(tx, id);
    await tx.assessment.delete({ where: { id } });
    await recordAudit(tx, { actor, action: "assessment.deleted", entityType: "Assessment", entityId: id });
  });
}

function questionData(input: QuestionInput) {
  return {
    type: input.type,
    prompt: input.prompt,
    points: input.points,
    ...(input.order !== undefined ? { order: input.order } : {}),
    acceptedAnswers: input.acceptedAnswers,
  };
}

const optionRows = (input: QuestionInput) =>
  input.options.map((o, order) => ({ text: o.text, isCorrect: o.isCorrect, order }));

export async function addQuestion(actor: AuditActor, assessmentId: string, input: QuestionInput) {
  return db.$transaction(async (tx) => {
    const exists = await tx.assessment.findUnique({ where: { id: assessmentId }, select: { id: true } });
    if (!exists) throw errors.notFound("Assessment");
    await assertNoAttempts(tx, assessmentId);
    const question = await tx.question.create({
      data: { ...questionData(input), assessmentId, options: { create: optionRows(input) } },
      include: { options: true },
    });
    await recordAudit(tx, {
      actor,
      action: "question.created",
      entityType: "Question",
      entityId: question.id,
      metadata: { assessmentId },
    });
    return question;
  });
}

export async function replaceQuestion(actor: AuditActor, questionId: string, input: QuestionInput) {
  return db.$transaction(async (tx) => {
    const current = await tx.question.findUnique({
      where: { id: questionId },
      select: { assessmentId: true },
    });
    if (!current) throw errors.notFound("Question");
    await assertNoAttempts(tx, current.assessmentId);
    await tx.option.deleteMany({ where: { questionId } });
    const question = await tx.question.update({
      where: { id: questionId },
      data: { ...questionData(input), options: { create: optionRows(input) } },
      include: { options: true },
    });
    await recordAudit(tx, {
      actor,
      action: "question.updated",
      entityType: "Question",
      entityId: questionId,
    });
    return question;
  });
}

export async function deleteQuestion(actor: AuditActor, questionId: string) {
  await db.$transaction(async (tx) => {
    const current = await tx.question.findUnique({
      where: { id: questionId },
      select: { assessmentId: true },
    });
    if (!current) throw errors.notFound("Question");
    await assertNoAttempts(tx, current.assessmentId);
    await tx.question.delete({ where: { id: questionId } });
    await recordAudit(tx, {
      actor,
      action: "question.deleted",
      entityType: "Question",
      entityId: questionId,
    });
  });
}

export async function listAttempts(assessmentId: string, query: In<typeof attemptListQuery>) {
  const where: Prisma.AttemptWhereInput = {
    assessmentId,
    ...(query.graduateId ? { graduateId: query.graduateId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const rows = await db.attempt.findMany({
    where,
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      startedAt: true,
      deadlineAt: true,
      submittedAt: true,
      score: true,
      maxScore: true,
      percentage: true,
      passed: true,
      graduate: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    ...cursorArgs(query),
  });
  return toPage(rows, query.limit);
}

/** Gives a graduate extra attempts beyond the assessment's limit (adds up). */
export async function grantRetake(actor: AuditActor, assessmentId: string, input: In<typeof retakeSchema>) {
  return db.$transaction(async (tx) => {
    const [assessment, graduate] = await Promise.all([
      tx.assessment.findUnique({ where: { id: assessmentId }, select: { id: true } }),
      tx.graduateProfile.findUnique({ where: { id: input.graduateId }, select: { id: true } }),
    ]);
    if (!assessment) throw errors.notFound("Assessment");
    if (!graduate) throw errors.notFound("Graduate");
    const grant = await tx.retakeGrant.upsert({
      where: { assessmentId_graduateId: { assessmentId, graduateId: input.graduateId } },
      update: {
        extraAttempts: { increment: input.extraAttempts },
        grantedById: actor.userId,
        reason: input.reason,
      },
      create: {
        assessmentId,
        graduateId: input.graduateId,
        extraAttempts: input.extraAttempts,
        grantedById: actor.userId,
        reason: input.reason,
      },
    });
    await recordAudit(tx, {
      actor,
      action: "assessment.retake_granted",
      entityType: "Assessment",
      entityId: assessmentId,
      after: { graduateId: input.graduateId, extraAttempts: grant.extraAttempts },
    });
    return grant;
  });
}
