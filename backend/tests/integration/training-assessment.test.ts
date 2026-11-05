import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST as addQuestion } from "../../app/api/v1/admin/assessments/[id]/questions/route";
import { POST as grantRetake } from "../../app/api/v1/admin/assessments/[id]/retakes/route";
import { PATCH as updateAssessment } from "../../app/api/v1/admin/assessments/[id]/route";
import { GET as listAttempts } from "../../app/api/v1/admin/assessments/[id]/attempts/route";
import { POST as createAssessment } from "../../app/api/v1/admin/assessments/route";
import { POST as createModule } from "../../app/api/v1/admin/courses/[id]/modules/route";
import { POST as createCourse } from "../../app/api/v1/admin/courses/route";
import { POST as createLesson } from "../../app/api/v1/admin/modules/[id]/lessons/route";
import { PUT as replaceQuestion } from "../../app/api/v1/admin/questions/[id]/route";
import { POST as startAttempt } from "../../app/api/v1/graduate/assessments/[id]/attempts/route";
import { GET as myAssessments } from "../../app/api/v1/graduate/assessments/route";
import { PUT as saveAnswers } from "../../app/api/v1/graduate/attempts/[id]/answers/route";
import { GET as getAttempt } from "../../app/api/v1/graduate/attempts/[id]/route";
import { POST as submit } from "../../app/api/v1/graduate/attempts/[id]/submit/route";
import { POST as completeLesson } from "../../app/api/v1/graduate/training/lessons/[id]/complete/route";
import { GET as getLesson } from "../../app/api/v1/graduate/training/lessons/[id]/route";
import { GET as training } from "../../app/api/v1/graduate/training/route";
import { db } from "@/server/db";
import { completeProfile, createOpenCohort, createUser, type TestUser } from "./factories";
import { call } from "./helpers";

const sent: string[] = [];
vi.mock("@/server/email/send", () => ({
  sendEmail: vi.fn(async (input: { template: string }) => {
    sent.push(input.template);
    return "logged";
  }),
}));

let admin: TestUser;
let grad: TestUser;
let outsider: TestUser;
let cohortId: string;
let applicationId: string;

async function enrol(user: TestUser, cohort: string, status: "IN_TRAINING" | "SUBMITTED") {
  const graduateId = await completeProfile(user);
  const app = await db.application.create({ data: { graduateId, cohortId: cohort, status } });
  return app.id;
}

beforeAll(async () => {
  [admin, grad, outsider] = await Promise.all([
    createUser("ADMIN"),
    createUser("GRADUATE", "Ngozi"),
    createUser("GRADUATE", "Femi"),
  ]);
  cohortId = (await createOpenCohort()).id;
  applicationId = await enrol(grad, cohortId, "IN_TRAINING");
  await enrol(outsider, (await createOpenCohort()).id, "IN_TRAINING");
});

describe("training", () => {
  const lessonIds: string[] = [];

  it("lets admins build a course and graduates of that cohort follow it", async () => {
    const course = await call(createCourse, {
      cookie: admin.cookie,
      body: { cohortId, title: "Workplace Basics", published: true },
    });
    expect(course.res.status).toBe(201);
    const mod = await call(createModule, {
      cookie: admin.cookie,
      params: { id: course.json.data.id },
      body: { title: "Week 1" },
    });
    for (const title of ["Email etiquette", "Using Excel"]) {
      const lesson = await call(createLesson, {
        cookie: admin.cookie,
        params: { id: mod.json.data.id },
        body: { title, content: "..." },
      });
      lessonIds.push(lesson.json.data.id);
    }

    const { json } = await call(training, { method: "GET", cookie: grad.cookie });
    expect(json.data.progress).toEqual({ completed: 0, total: 2, percent: 0 });
  });

  it("hides another cohort's lessons and admin routes", async () => {
    const other = await call(getLesson, {
      method: "GET",
      cookie: outsider.cookie,
      params: { id: lessonIds[0] },
    });
    expect(other.res.status).toBe(404);
    const asGrad = await call(createCourse, { cookie: grad.cookie, body: { cohortId, title: "Hack" } });
    expect(asGrad.res.status).toBe(403);
  });

  it("moves the application to FINAL_ASSESSMENT once every lesson is complete", async () => {
    await call(completeLesson, { cookie: grad.cookie, params: { id: lessonIds[0] } });
    // Completing twice is harmless.
    const again = await call(completeLesson, { cookie: grad.cookie, params: { id: lessonIds[0] } });
    expect(again.json.data).toMatchObject({ completed: 1, total: 2 });

    const done = await call(completeLesson, { cookie: grad.cookie, params: { id: lessonIds[1] } });
    expect(done.json.data.percent).toBe(100);
    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(app.status).toBe("FINAL_ASSESSMENT");
  });
});

describe("final assessment", () => {
  let assessmentId: string;
  let q1: { id: string; options: Array<{ id: string; text: string; isCorrect: boolean }> };

  const singleChoice = {
    type: "SINGLE_CHOICE",
    prompt: "Capital of Nigeria?",
    options: [
      { text: "Lagos", isCorrect: false },
      { text: "Abuja", isCorrect: true },
    ],
  };

  it("lets admins build an assessment but only publish it with questions", async () => {
    const created = await call(createAssessment, {
      cookie: admin.cookie,
      body: {
        cohortId,
        type: "FINAL",
        title: "Final test",
        timeLimitMinutes: 30,
        passMark: 60,
        maxAttempts: 1,
      },
    });
    assessmentId = created.json.data.id;
    const params = { id: assessmentId };
    const early = await call(updateAssessment, {
      method: "PATCH",
      cookie: admin.cookie,
      params,
      body: { published: true },
    });
    expect(early.res.status).toBe(400);

    q1 = (await call(addQuestion, { cookie: admin.cookie, params, body: singleChoice })).json.data;
    await call(addQuestion, {
      cookie: admin.cookie,
      params,
      body: { type: "SHORT_TEXT", prompt: "Spreadsheet app?", acceptedAnswers: ["Excel", "Microsoft Excel"] },
    });
    const published = await call(updateAssessment, {
      method: "PATCH",
      cookie: admin.cookie,
      params,
      body: { published: true },
    });
    expect(published.json.data.published).toBe(true);
  });

  it("never sends the answer key to the graduate", async () => {
    const list = await call(myAssessments, { method: "GET", cookie: grad.cookie });
    expect(list.json.data.find((a: { id: string }) => a.id === assessmentId).canStart).toBe(true);

    const started = await call(startAttempt, { cookie: grad.cookie, params: { id: assessmentId } });
    expect(started.res.status).toBe(201);
    expect(started.json.data.questions).toHaveLength(2);
    const raw = JSON.stringify(started.json);
    expect(raw).not.toContain("isCorrect");
    expect(raw).not.toContain("acceptedAnswers");
    expect(raw).not.toContain("Microsoft Excel");

    // Starting again resumes the same attempt.
    const resumed = await call(startAttempt, { cookie: grad.cookie, params: { id: assessmentId } });
    expect(resumed.json.data.id).toBe(started.json.data.id);
  });

  it("fails a wrong attempt, then blocks a second one until a retake is granted", async () => {
    const attempt = await db.attempt.findFirstOrThrow({ where: { assessmentId, status: "IN_PROGRESS" } });
    const params = { id: attempt.id };
    const wrong = q1.options.find((o) => !o.isCorrect)!.id;

    const invalid = await call(saveAnswers, {
      method: "PUT",
      cookie: grad.cookie,
      params,
      body: { answers: [{ questionId: q1.id, selectedOptionIds: ["not-an-option"] }] },
    });
    expect(invalid.res.status).toBe(400);

    const stranger = await call(getAttempt, { method: "GET", cookie: outsider.cookie, params });
    expect(stranger.res.status).toBe(404);

    const result = await call(submit, {
      cookie: grad.cookie,
      params,
      body: { answers: [{ questionId: q1.id, selectedOptionIds: [wrong] }] },
    });
    expect(result.json.data.result).toEqual({ percentage: 0, passed: false });
    expect(result.json.data).not.toHaveProperty("questions");

    const blocked = await call(startAttempt, { cookie: grad.cookie, params: { id: assessmentId } });
    expect(blocked.res.status).toBe(409);

    const locked = await call(replaceQuestion, {
      method: "PUT",
      cookie: admin.cookie,
      params: { id: q1.id },
      body: singleChoice,
    });
    expect(locked.res.status).toBe(409);
  });

  it("qualifies the graduate after a passing retake", async () => {
    const graduateId = (await db.application.findUniqueOrThrow({ where: { id: applicationId } })).graduateId;
    await call(grantRetake, { cookie: admin.cookie, params: { id: assessmentId }, body: { graduateId } });

    const started = await call(startAttempt, { cookie: grad.cookie, params: { id: assessmentId } });
    expect(started.json.data.attemptNumber).toBe(2);
    const shortText = started.json.data.questions.find((q: { type: string }) => q.type === "SHORT_TEXT");
    const right = q1.options.find((o) => o.isCorrect)!.id;

    sent.length = 0;
    const result = await call(submit, {
      cookie: grad.cookie,
      params: { id: started.json.data.id },
      body: {
        answers: [
          { questionId: q1.id, selectedOptionIds: [right] },
          { questionId: shortText.id, textAnswer: " excel " },
        ],
      },
    });
    expect(result.json.data.result).toEqual({ percentage: 100, passed: true });
    expect(sent).toEqual(["assessment-result", "qualified"]);

    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(app.status).toBe("QUALIFIED");

    const attempts = await call(listAttempts, {
      method: "GET",
      cookie: admin.cookie,
      params: { id: assessmentId },
    });
    expect(attempts.json.data).toHaveLength(2);
  });
});

describe("screening assessment and deadlines", () => {
  it("expires an overdue attempt on the server and moves the application to SCREENING", async () => {
    const applicant = await createUser("GRADUATE", "Uche");
    const appId = await enrol(applicant, cohortId, "SUBMITTED");

    const blocked = await call(training, { method: "GET", cookie: applicant.cookie });
    expect(blocked.res.status).toBe(403);

    const screening = await db.assessment.create({
      data: {
        cohortId,
        type: "SCREENING",
        title: "Screening",
        timeLimitMinutes: 10,
        passMark: 50,
        published: true,
        questions: {
          create: {
            type: "SINGLE_CHOICE",
            prompt: "2 + 2?",
            options: { create: [{ text: "4", isCorrect: true }, { text: "5" }] },
          },
        },
      },
      include: { questions: true },
    });
    const started = await call(startAttempt, { cookie: applicant.cookie, params: { id: screening.id } });
    // Simulate the clock running out.
    await db.attempt.update({
      where: { id: started.json.data.id },
      data: { deadlineAt: new Date(Date.now() - 60_000) },
    });

    const late = await call(saveAnswers, {
      method: "PUT",
      cookie: applicant.cookie,
      params: { id: started.json.data.id },
      body: { answers: [{ questionId: screening.questions[0].id, selectedOptionIds: [] }] },
    });
    expect(late.res.status).toBe(409);

    const attempt = await db.attempt.findUniqueOrThrow({ where: { id: started.json.data.id } });
    expect(attempt.status).toBe("EXPIRED");
    const app = await db.application.findUniqueOrThrow({ where: { id: appId } });
    expect(app.status).toBe("SCREENING");
  });
});
