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
    include: { _count: { select: { questions: { where: { archivedAt: null } }, attempts: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

/** Admin view, answer key included. Never return this to graduates. */
export async function getAssessmentForAdmin(id: string) {
  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      questions: {
        // Retired versions are kept for past attempts but aren't part of the test any more.
        where: { archivedAt: null },
        orderBy: [{ order: "asc" }, { id: "asc" }],
        include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!assessment) throw errors.notFound("Assessment");
  return assessment;
}

/** The SIIP test stays editable after attempts: changes apply to new attempts only. */
async function isSiip(tx: Tx, assessmentId: string) {
  const a = await tx.assessment.findUnique({ where: { id: assessmentId }, select: { type: true } });
  return a?.type === "SIIP";
}

/** A question someone has been given (in an attempt's layout or with an answer) is kept for the record. */
async function questionInUse(tx: Tx, questionId: string, assessmentId: string) {
  if (await tx.attemptAnswer.findFirst({ where: { questionId }, select: { id: true } })) return true;
  const rows = await tx.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM "Attempt"
    WHERE "assessmentId" = ${assessmentId} AND "layout"::text LIKE ${"%" + questionId + "%"}`;
  return (rows[0]?.n ?? 0) > 0;
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
    // The SIIP pass mark can change any time (it applies to attempts finished from now on).
    if (input.passMark !== undefined && input.passMark !== before.passMark && before.type !== "SIIP") {
      await assertNoAttempts(tx, id);
    }
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

async function assertVideoOf(tx: Tx, assessmentId: string, videoId: string) {
  const video = await tx.testVideo.findFirst({ where: { id: videoId, assessmentId }, select: { id: true } });
  if (!video) throw errors.badRequest("That video isn't part of this test");
}

function questionData(input: QuestionInput) {
  return {
    type: input.type,
    prompt: input.prompt,
    points: input.points,
    ...(input.order !== undefined ? { order: input.order } : {}),
    acceptedAnswers: input.acceptedAnswers,
    ...(input.videoId !== undefined ? { videoId: input.videoId ?? null } : {}),
  };
}

const optionRows = (input: QuestionInput) =>
  input.options.map((o, order) => ({ text: o.text, isCorrect: o.isCorrect, order }));

export async function addQuestion(actor: AuditActor, assessmentId: string, input: QuestionInput) {
  return db.$transaction(async (tx) => {
    const exists = await tx.assessment.findUnique({ where: { id: assessmentId }, select: { id: true } });
    if (!exists) throw errors.notFound("Assessment");
    if (!(await isSiip(tx, assessmentId))) await assertNoAttempts(tx, assessmentId);
    if (input.videoId) await assertVideoOf(tx, assessmentId, input.videoId);
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
    if (input.videoId) await assertVideoOf(tx, current.assessmentId, input.videoId);
    if (await isSiip(tx, current.assessmentId)) {
      if (await questionInUse(tx, questionId, current.assessmentId)) {
        // Retire the old version (past attempts keep it) and add the new one in its place.
        const old = await tx.question.update({
          where: { id: questionId },
          data: { archivedAt: new Date() },
          select: { order: true },
        });
        const replacement = await tx.question.create({
          data: {
            ...questionData({ ...input, order: input.order ?? old.order }),
            assessmentId: current.assessmentId,
            options: { create: optionRows(input) },
          },
          include: { options: true },
        });
        await recordAudit(tx, {
          actor,
          action: "question.replaced",
          entityType: "Question",
          entityId: replacement.id,
          metadata: { replaces: questionId, assessmentId: current.assessmentId },
        });
        return replacement;
      }
    } else {
      await assertNoAttempts(tx, current.assessmentId);
    }
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
    if (await isSiip(tx, current.assessmentId)) {
      if (await questionInUse(tx, questionId, current.assessmentId)) {
        // Kept for past attempts; left out of new ones.
        await tx.question.update({ where: { id: questionId }, data: { archivedAt: new Date() } });
        await recordAudit(tx, { actor, action: "question.retired", entityType: "Question", entityId: questionId });
        return;
      }
    } else {
      await assertNoAttempts(tx, current.assessmentId);
    }
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
