import { beforeAll, describe, expect, it, vi } from "vitest";
import { PATCH as patchAssessment } from "../../app/api/v1/admin/assessments/[id]/route";
import { DELETE as deleteQuestion, PUT as putQuestion } from "../../app/api/v1/admin/questions/[id]/route";
import { GET as adminSiip } from "../../app/api/v1/admin/siip-test/route";
import { DELETE as deleteVideo } from "../../app/api/v1/admin/siip-test/videos/[id]/route";
import { POST as reorder } from "../../app/api/v1/admin/siip-test/videos/reorder/route";
import { POST as addVideo } from "../../app/api/v1/admin/siip-test/videos/route";
import { POST as startAttempt } from "../../app/api/v1/graduate/assessments/[id]/attempts/route";
import { POST as submit } from "../../app/api/v1/graduate/attempts/[id]/submit/route";
import { GET as mySiip } from "../../app/api/v1/graduate/siip-test/route";
import { POST as watched } from "../../app/api/v1/graduate/siip-test/videos/[id]/watched/route";
import { db } from "@/server/db";
import { completeProfile, createOpenCohort, createUser, type TestUser } from "./factories";
import { call } from "./helpers";

vi.mock("@/server/email/send", () => ({ sendEmail: vi.fn(async () => "logged") }));

const DAY = 24 * 60 * 60 * 1000;
let admin: TestUser;
let owner: TestUser;
let intern: TestUser;
let newcomer: TestUser;
let testId: string;
let videoIds: string[];
let placementId: string;

/** The SIIP test as the migration creates it, with two videos (one still a placeholder). */
async function siipTest() {
  const test = await db.assessment.create({
    data: {
      type: "SIIP",
      title: "The SIIP test",
      timeLimitMinutes: 20,
      passMark: 70,
      maxAttempts: 100,
      published: true,
      retakeAfterHours: 24,
      unlockAfterWeeks: 8,
      minCheckInRating: 3,
      videos: {
        create: [
          { title: "Courtesy at work", youtubeId: "dQw4w9WgXcQ", order: 1 },
          { title: "Meeting deadlines", youtubeId: null, order: 2 },
        ],
      },
    },
    include: { videos: { orderBy: { order: "asc" } } },
  });
  for (const [i, v] of test.videos.entries()) {
    await db.question.create({
      data: {
        assessmentId: test.id,
        type: "SINGLE_CHOICE",
        prompt: `Conduct question ${i + 1}`,
        order: i + 1,
        acceptedAnswers: [],
        videoId: v.id,
        options: {
          create: [
            { text: "The considerate thing", isCorrect: true, order: 0 },
            { text: "The careless thing", isCorrect: false, order: 1 },
          ],
        },
      },
    });
  }
  return { id: test.id, videos: test.videos.map((v) => v.id) };
}

/** An intern placed `daysAgo` days ago, supervised by the owner. */
async function placedIntern(user: TestUser, daysAgo: number) {
  const graduateId = await completeProfile(user);
  const cohort = await createOpenCohort();
  const company = await db.company.create({
    data: {
      name: "Acme Media",
      rcNumber: `RC${Date.now() % 10_000_000}`,
      industry: "Media",
      address: "1 Marina",
      state: "Lagos",
      verificationStatus: "VERIFIED",
      members: { create: { userId: owner.id, role: "OWNER" } },
    },
    include: { members: true },
  });
  const opening = await db.internshipOpening.create({
    data: {
      companyId: company.id,
      title: "Content Intern",
      description: "Create content for our brands every week.",
      slots: 1,
      workMode: "REMOTE",
      schedule: "FULL_TIME",
      status: "CLOSED",
      createdById: owner.id,
    },
  });
  const app = await db.application.create({ data: { graduateId, cohortId: cohort.id, status: "PLACED" } });
  const match = await db.match.create({
    data: {
      graduateId,
      applicationId: app.id,
      openingId: opening.id,
      score: 90,
      scoreBreakdown: {},
      status: "COMPANY_ACCEPTED",
      proposedById: admin.id,
    },
  });
  const start = new Date(Date.now() - daysAgo * DAY);
  const placement = await db.placement.create({
    data: {
      matchId: match.id,
      applicationId: app.id,
      graduateId,
      openingId: opening.id,
      companyId: company.id,
      supervisorId: company.members[0].id,
      startDate: start,
      endDate: new Date(start.getTime() + 90 * DAY),
    },
  });
  return placement.id;
}

const state = async (u: TestUser) => (await call(mySiip, { method: "GET", cookie: u.cookie })).json.data;
const start = (u: TestUser) => call(startAttempt, { cookie: u.cookie, params: { id: testId } });

/** Answers every question in the attempt, right or wrong. */
async function answerAll(attempt: { id: string; questions: Array<{ id: string }> }, right: boolean) {
  const answers = [];
  for (const q of attempt.questions) {
    const opt = await db.option.findFirstOrThrow({ where: { questionId: q.id, isCorrect: right } });
    answers.push({ questionId: q.id, selectedOptionIds: [opt.id] });
  }
  return call(submit, { cookie: intern.cookie, params: { id: attempt.id }, body: { answers } });
}

beforeAll(async () => {
  [admin, owner, intern, newcomer] = await Promise.all([
    createUser("ADMIN"),
    createUser("COMPANY_MEMBER", "Bisi"),
    createUser("GRADUATE", "Kola"),
    createUser("GRADUATE", "Dayo"),
  ]);
  ({ id: testId, videos: videoIds } = await siipTest());
  await completeProfile(newcomer);
  placementId = await placedIntern(intern, 21);
});

describe("the SIIP test", () => {
  it("stays shut until the intern has been placed for 8 weeks", async () => {
    expect((await state(newcomer)).state).toBe("LOCKED_INTERNSHIP");
    expect((await start(newcomer)).res.status).toBe(403);

    const three = await state(intern);
    expect(three.state).toBe("LOCKED_INTERNSHIP");
    expect(new Date(three.unlocksAt).getTime()).toBeGreaterThan(Date.now());
    expect(three.test).toMatchObject({ passMark: 70, retakeAfterHours: 24, questionCount: 2 });
  });

  it("then needs a satisfactory supervisor check-in", async () => {
    await db.placement.update({ where: { id: placementId }, data: { startDate: new Date(Date.now() - 70 * DAY) } });
    expect((await state(intern)).state).toBe("LOCKED_REVIEW");

    const authorUserId = owner.id;
    await db.checkIn.create({
      data: { placementId, authorType: "SUPERVISOR", authorUserId, month: 1, progressNote: "Slow start", rating: 4 },
    });
    await db.checkIn.create({
      data: { placementId, authorType: "SUPERVISOR", authorUserId, month: 2, progressNote: "Missed deadlines", rating: 2 },
    });
    // The latest review counts: month 2 is below 3.
    expect((await state(intern)).state).toBe("LOCKED_REVIEW");
    await db.checkIn.updateMany({ where: { placementId, month: 2 }, data: { rating: 3 } });
    const s = await state(intern);
    expect(s).toMatchObject({ state: "VIDEOS", videosLeft: 2 });
    expect(s.videos.map((v: { youtubeId: string | null }) => v.youtubeId)).toEqual(["dQw4w9WgXcQ", null]);
  });

  it("opens the quiz only after every video is marked watched", async () => {
    expect((await start(intern)).res.status).toBe(403);
    await call(watched, { cookie: intern.cookie, params: { id: videoIds[0] } });
    expect((await state(intern)).videosLeft).toBe(1);
    const after = await call(watched, { cookie: intern.cookie, params: { id: videoIds[1] } });
    expect(after.json.data.state).toBe("READY");
  });

  it("records a failed attempt and makes the intern wait 24 hours", async () => {
    const attempt = await start(intern);
    expect(attempt.res.status).toBe(201);
    expect(attempt.json.data.questions).toHaveLength(2);
    const result = await answerAll(attempt.json.data, false);
    expect(result.json.data).toMatchObject({ status: "SUBMITTED", result: { passed: false } });

    const s = await state(intern);
    expect(s.state).toBe("COOLDOWN");
    const wait = new Date(s.nextAttemptAt).getTime() - Date.now();
    expect(wait).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect((await start(intern)).res.status).toBe(403);
  });

  it("lets admins change the wait and pass mark, and the intern passes", async () => {
    const changed = await call(patchAssessment, {
      method: "PATCH",
      cookie: admin.cookie,
      params: { id: testId },
      body: { retakeAfterHours: 0, passMark: 80 },
    });
    expect(changed.res.status).toBe(200);
    const attempt = await start(intern);
    expect(attempt.res.status).toBe(201);
    const result = await answerAll(attempt.json.data, true);
    expect(result.json.data.result).toMatchObject({ passed: true, percentage: 100 });

    const s = await state(intern);
    expect(s.state).toBe("PASSED");
    expect(s.attempts).toHaveLength(2);
    expect((await start(intern)).res.status).toBe(409);
  });

  it("keeps past attempts intact when admins edit or remove questions", async () => {
    const before = await call(adminSiip, { method: "GET", cookie: admin.cookie });
    const q = before.json.data.questions[0];
    const edited = await call(putQuestion, {
      method: "PUT",
      cookie: admin.cookie,
      params: { id: q.id },
      body: {
        type: "SINGLE_CHOICE",
        prompt: "A clearer conduct question",
        videoId: videoIds[0],
        options: [
          { text: "Ask your supervisor", isCorrect: true },
          { text: "Guess", isCorrect: false },
        ],
      },
    });
    expect(edited.res.status).toBe(200);
    expect(edited.json.data.id).not.toBe(q.id);
    expect((await db.question.findUniqueOrThrow({ where: { id: q.id } })).archivedAt).not.toBeNull();
    // The old answers are still there.
    expect(await db.attemptAnswer.count({ where: { questionId: q.id } })).toBe(2);

    const gone = await call(deleteQuestion, { method: "DELETE", cookie: admin.cookie, params: { id: before.json.data.questions[1].id } });
    expect(gone.res.status).toBe(200);
    const after = await call(adminSiip, { method: "GET", cookie: admin.cookie });
    expect(after.json.data.questions.map((x: { prompt: string }) => x.prompt)).toEqual(["A clearer conduct question"]);
    expect(after.json.data.stats).toMatchObject({ attempts: 2, passed: 1 });
  });

  it("lets admins add, reorder and remove videos with any YouTube link", async () => {
    const bad = await call(addVideo, {
      cookie: admin.cookie,
      body: { title: "Punctuality", youtubeUrl: "https://vimeo.com/123" },
    });
    expect(bad.res.status).toBe(422);
    const short = await call(addVideo, {
      cookie: admin.cookie,
      body: { title: "Punctuality", youtubeUrl: "https://youtu.be/abcdefghijk?t=10" },
    });
    expect(short.json.data).toMatchObject({ youtubeId: "abcdefghijk", order: 3 });

    const ids = [short.json.data.id, ...videoIds];
    const ordered = await call(reorder, { cookie: admin.cookie, body: { ids } });
    expect(ordered.json.data.map((v: { id: string }) => v.id)).toEqual(ids);
    expect((await call(reorder, { cookie: admin.cookie, body: { ids: ids.slice(1) } })).res.status).toBe(400);

    await call(deleteVideo, { method: "DELETE", cookie: admin.cookie, params: { id: short.json.data.id } });
    expect(await db.testVideo.count({ where: { assessmentId: testId } })).toBe(2);
    expect((await call(adminSiip, { method: "GET", cookie: intern.cookie })).res.status).toBe(403);
  });
});
