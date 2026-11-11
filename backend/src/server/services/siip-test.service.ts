// The SIIP test: short videos on workplace conduct, then a quiz about them.
//
// When it opens (the client's rule): during or after an internship, once the
// intern has been placed for `unlockAfterWeeks` and their supervisor's latest
// monthly check-in is rated at least `minCheckInRating` out of 5. The quiz then
// needs every video marked as watched. Attempts are unlimited, with a wait of
// `retakeAfterHours` after a failed one; every attempt is kept. All of these
// settings live on the SIIP assessment and admins change them without code.
import { db, type DbOrTx } from "@/server/db";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import type { z } from "zod";
import type { testVideoSchema, updateTestVideoSchema } from "@/server/validators/assessment";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export type SiipState =
  | "PASSED"
  | "LOCKED_INTERNSHIP"
  | "LOCKED_REVIEW"
  | "IN_PROGRESS"
  | "COOLDOWN"
  | "VIDEOS"
  | "READY";

const settingsSelect = {
  id: true,
  title: true,
  description: true,
  passMark: true,
  timeLimitMinutes: true,
  retakeAfterHours: true,
  unlockAfterWeeks: true,
  minCheckInRating: true,
  published: true,
} as const;

/** The SIIP test (there is one). */
export function findSiipTest(client: DbOrTx = db) {
  return client.assessment.findFirst({
    where: { type: "SIIP" },
    select: settingsSelect,
    orderBy: { createdAt: "asc" },
  });
}

type SiipSettings = NonNullable<Awaited<ReturnType<typeof findSiipTest>>>;

/**
 * Where the intern stands with the SIIP test, and why. Used for the Tests page
 * and, inside the start transaction, to decide whether a new attempt may begin.
 */
export async function siipGate(client: DbOrTx, graduateId: string, test: SiipSettings, now = new Date()) {
  const [placements, attempts, videos] = await Promise.all([
    client.placement.findMany({
      where: { graduateId, status: { in: ["ACTIVE", "COMPLETED"] } },
      select: {
        startDate: true,
        checkIns: {
          where: { authorType: "SUPERVISOR" },
          select: { rating: true, month: true, createdAt: true },
          orderBy: [{ month: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
      orderBy: { startDate: "asc" },
    }),
    client.attempt.findMany({
      where: { assessmentId: test.id, graduateId },
      select: { id: true, status: true, passed: true, submittedAt: true, deadlineAt: true },
      orderBy: { attemptNumber: "desc" },
    }),
    client.testVideo.findMany({
      where: { assessmentId: test.id },
      select: { id: true, watches: { where: { graduateId }, select: { id: true } } },
    }),
  ]);
  const videosLeft = videos.filter((v) => v.watches.length === 0).length;
  const result = (state: SiipState, message: string, extra: { unlocksAt?: Date; nextAttemptAt?: Date; inProgressAttemptId?: string } = {}) => ({
    state,
    message,
    videosLeft,
    unlocksAt: extra.unlocksAt ?? null,
    nextAttemptAt: extra.nextAttemptAt ?? null,
    inProgressAttemptId: extra.inProgressAttemptId ?? null,
  });

  if (attempts.some((a) => a.passed)) return result("PASSED", "You've passed the SIIP test.");

  if (!placements.length) {
    return result("LOCKED_INTERNSHIP", "The SIIP test opens during your internship.");
  }
  const first = placements[0];
  const unlocksAt = new Date(first.startDate.getTime() + test.unlockAfterWeeks * WEEK);
  if (now < unlocksAt) {
    return result("LOCKED_INTERNSHIP", `The SIIP test opens ${test.unlockAfterWeeks} weeks into your internship.`, { unlocksAt });
  }
  const latest = placements
    .flatMap((p) => p.checkIns)
    .sort((a, b) => b.month - a.month || b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!latest || latest.rating === null || latest.rating < test.minCheckInRating) {
    return result(
      "LOCKED_REVIEW",
      latest
        ? "It opens once your supervisor's monthly review is satisfactory."
        : "It opens once your supervisor has sent a satisfactory monthly review.",
    );
  }

  const open = attempts.find((a) => a.status === "IN_PROGRESS" && a.deadlineAt > now);
  if (open) return result("IN_PROGRESS", "You have a test in progress.", { inProgressAttemptId: open.id });

  const lastFinished = attempts.find((a) => a.status !== "IN_PROGRESS" && a.submittedAt);
  if (lastFinished?.submittedAt) {
    const nextAttemptAt = new Date(lastFinished.submittedAt.getTime() + test.retakeAfterHours * HOUR);
    if (now < nextAttemptAt) {
      return result("COOLDOWN", `You can try again after a ${test.retakeAfterHours}-hour wait.`, { nextAttemptAt });
    }
  }

  if (videosLeft > 0) {
    return result("VIDEOS", videosLeft === 1 ? "Watch the last video to unlock the quiz." : `Watch the ${videosLeft} videos to unlock the quiz.`);
  }
  return result("READY", "You're ready to take the quiz.");
}

/** Everything the intern's Tests page needs. Null if there is no published SIIP test. */
export async function getMySiipTest(graduateId: string) {
  const test = await findSiipTest();
  if (!test || !test.published) return null;
  const [gate, videos, attempts, questionCount] = await Promise.all([
    siipGate(db, graduateId, test),
    db.testVideo.findMany({
      where: { assessmentId: test.id },
      select: {
        id: true,
        title: true,
        description: true,
        youtubeId: true,
        order: true,
        watches: { where: { graduateId }, select: { watchedAt: true } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    db.attempt.findMany({
      where: { assessmentId: test.id, graduateId },
      select: { id: true, attemptNumber: true, status: true, percentage: true, passed: true, startedAt: true, submittedAt: true },
      orderBy: { attemptNumber: "desc" },
    }),
    db.question.count({ where: { assessmentId: test.id, archivedAt: null } }),
  ]);
  return {
    test: {
      id: test.id,
      title: test.title,
      description: test.description,
      passMark: test.passMark,
      timeLimitMinutes: test.timeLimitMinutes,
      retakeAfterHours: test.retakeAfterHours,
      questionCount,
    },
    ...gate,
    videos: videos.map(({ watches, ...v }) => ({ ...v, watchedAt: watches[0]?.watchedAt ?? null })),
    attempts,
  };
}

export async function markVideoWatched(graduateId: string, videoId: string) {
  const video = await db.testVideo.findFirst({
    where: { id: videoId, assessment: { type: "SIIP", published: true } },
    select: { id: true },
  });
  if (!video) throw errors.notFound("Video");
  await db.videoWatch.upsert({
    where: { videoId_graduateId: { videoId, graduateId } },
    update: {},
    create: { videoId, graduateId },
  });
  return getMySiipTest(graduateId);
}

// ─── Admin ────────────────────────────────────────────────────────────────────

async function requireSiipTest(client: DbOrTx = db) {
  const test = await findSiipTest(client);
  if (!test) throw errors.notFound("SIIP test");
  return test;
}

/** The SIIP test as admins manage it: settings, videos, current questions and attempt numbers. */
export async function getSiipTestForAdmin() {
  const test = await requireSiipTest();
  const [videos, questions, attempts, passed] = await Promise.all([
    db.testVideo.findMany({
      where: { assessmentId: test.id },
      select: {
        id: true,
        title: true,
        description: true,
        youtubeId: true,
        order: true,
        _count: { select: { watches: true, questions: { where: { archivedAt: null } } } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    db.question.findMany({
      where: { assessmentId: test.id, archivedAt: null },
      select: {
        id: true,
        type: true,
        prompt: true,
        points: true,
        order: true,
        videoId: true,
        acceptedAnswers: true,
        options: { select: { id: true, text: true, isCorrect: true, order: true }, orderBy: { order: "asc" } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    db.attempt.count({ where: { assessmentId: test.id, status: { not: "IN_PROGRESS" } } }),
    db.attempt.count({ where: { assessmentId: test.id, passed: true } }),
  ]);
  return {
    ...test,
    videos: videos.map(({ _count, ...v }) => ({ ...v, watchCount: _count.watches, questionCount: _count.questions })),
    questions,
    stats: { attempts, passed },
  };
}

export async function createVideo(actor: AuditActor, input: z.infer<typeof testVideoSchema>) {
  const test = await requireSiipTest();
  return db.$transaction(async (tx) => {
    const last = await tx.testVideo.aggregate({ where: { assessmentId: test.id }, _max: { order: true } });
    const video = await tx.testVideo.create({
      data: {
        assessmentId: test.id,
        title: input.title,
        description: input.description ?? null,
        youtubeId: input.youtubeUrl ?? null,
        order: (last._max.order ?? 0) + 1,
      },
    });
    await recordAudit(tx, { actor, action: "siip_video.created", entityType: "TestVideo", entityId: video.id, after: { title: video.title } });
    return video;
  });
}

export async function updateVideo(actor: AuditActor, id: string, input: z.infer<typeof updateTestVideoSchema>) {
  return db.$transaction(async (tx) => {
    const before = await tx.testVideo.findUnique({ where: { id } });
    if (!before) throw errors.notFound("Video");
    const video = await tx.testVideo.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.youtubeUrl !== undefined ? { youtubeId: input.youtubeUrl ?? null } : {}),
      },
    });
    await recordAudit(tx, {
      actor,
      action: "siip_video.updated",
      entityType: "TestVideo",
      entityId: id,
      before: { title: before.title, youtubeId: before.youtubeId },
      after: { title: video.title, youtubeId: video.youtubeId },
    });
    return video;
  });
}

/** Questions about a removed video stay in the quiz, unlinked. */
export async function deleteVideo(actor: AuditActor, id: string) {
  await db.$transaction(async (tx) => {
    const video = await tx.testVideo.findUnique({ where: { id }, select: { title: true } });
    if (!video) throw errors.notFound("Video");
    await tx.testVideo.delete({ where: { id } });
    await recordAudit(tx, { actor, action: "siip_video.deleted", entityType: "TestVideo", entityId: id, before: { title: video.title } });
  });
  return { deleted: true };
}

export async function reorderVideos(actor: AuditActor, ids: string[]) {
  const test = await requireSiipTest();
  return db.$transaction(async (tx) => {
    const existing = await tx.testVideo.findMany({ where: { assessmentId: test.id }, select: { id: true } });
    const known = new Set(existing.map((v) => v.id));
    if (ids.length !== known.size || !ids.every((id) => known.has(id)) || new Set(ids).size !== ids.length) {
      throw errors.badRequest("Send every video exactly once, in the new order");
    }
    for (const [i, id] of ids.entries()) await tx.testVideo.update({ where: { id }, data: { order: i + 1 } });
    await recordAudit(tx, { actor, action: "siip_video.reordered", entityType: "Assessment", entityId: test.id, after: { order: ids } });
    return tx.testVideo.findMany({ where: { assessmentId: test.id }, orderBy: { order: "asc" } });
  });
}
