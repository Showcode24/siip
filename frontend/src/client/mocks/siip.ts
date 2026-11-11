// Demo version of the SIIP test (same rules as backend/src/server/services/siip-test.service.ts).
import type { z } from "zod";
import { testVideoSchema, updateTestVideoSchema } from "@siip/shared/validators/assessment";
import type { MySiipTest, SiipState, SiipTestAdmin } from "@/client/api/types";
import { audit, db, iso, newId, type DbAssessment, type DbGraduate } from "./db";
import { badRequest, notFound, requireAdmin, requireGraduate } from "./logic";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const GRACE = 30_000;

export const siipTest = (): DbAssessment | undefined => db.assessments.find((a) => a.type === "SIIP");
const videosOf = (testId: string) =>
  db.videos.filter((v) => v.assessmentId === testId).sort((a, b) => a.order - b.order);
const watchedAt = (videoId: string, graduateId: string) => db.videoWatches.get(`${videoId}:${graduateId}`) ?? null;

/** Where the intern stands with the SIIP test, and why. */
export function siipGate(g: DbGraduate, test: DbAssessment, now = Date.now()) {
  const placements = db.placements
    .filter((p) => p.graduateId === g.id && (p.status === "ACTIVE" || p.status === "COMPLETED"))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const attempts = db.attempts
    .filter((t) => t.assessmentId === test.id && t.graduateId === g.id)
    .sort((a, b) => b.attemptNumber - a.attemptNumber);
  const videosLeft = videosOf(test.id).filter((v) => !watchedAt(v.id, g.id)).length;
  const result = (state: SiipState, message: string, extra: Partial<Pick<MySiipTest, "unlocksAt" | "nextAttemptAt" | "inProgressAttemptId">> = {}) => ({
    state,
    message,
    videosLeft,
    unlocksAt: extra.unlocksAt ?? null,
    nextAttemptAt: extra.nextAttemptAt ?? null,
    inProgressAttemptId: extra.inProgressAttemptId ?? null,
  });

  if (attempts.some((t) => t.passed)) return result("PASSED", "You've passed the SIIP test.");
  if (!placements.length) return result("LOCKED_INTERNSHIP", "The SIIP test opens during your internship.");
  const unlocksAt = new Date(new Date(placements[0].startDate).getTime() + test.unlockAfterWeeks * WEEK);
  if (now < unlocksAt.getTime()) {
    return result("LOCKED_INTERNSHIP", `The SIIP test opens ${test.unlockAfterWeeks} weeks into your internship.`, {
      unlocksAt: unlocksAt.toISOString(),
    });
  }
  const ids = new Set(placements.map((p) => p.id));
  const latest = db.checkIns
    .filter((c) => ids.has(c.placementId) && c.authorType === "SUPERVISOR")
    .sort((a, b) => b.month - a.month || b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest || latest.rating === null || latest.rating < test.minCheckInRating) {
    return result(
      "LOCKED_REVIEW",
      latest
        ? "It opens once your supervisor's monthly review is satisfactory."
        : "It opens once your supervisor has sent a satisfactory monthly review.",
    );
  }
  const open = attempts.find((t) => t.status === "IN_PROGRESS" && new Date(t.deadlineAt).getTime() + GRACE > now);
  if (open) return result("IN_PROGRESS", "You have a test in progress.", { inProgressAttemptId: open.id });
  const last = attempts.find((t) => t.status !== "IN_PROGRESS" && t.submittedAt);
  if (last?.submittedAt) {
    const next = new Date(last.submittedAt).getTime() + test.retakeAfterHours * HOUR;
    if (now < next) {
      return result("COOLDOWN", `You can try again after a ${test.retakeAfterHours}-hour wait.`, {
        nextAttemptAt: new Date(next).toISOString(),
      });
    }
  }
  if (videosLeft > 0) {
    return result("VIDEOS", videosLeft === 1 ? "Watch the last video to unlock the quiz." : `Watch the ${videosLeft} videos to unlock the quiz.`);
  }
  return result("READY", "You're ready to take the quiz.");
}

export function getMySiipTest(): MySiipTest | null {
  const { graduate } = requireGraduate();
  const test = siipTest();
  if (!test?.published) return null;
  return {
    test: {
      id: test.id,
      title: test.title,
      description: test.description,
      passMark: test.passMark,
      timeLimitMinutes: test.timeLimitMinutes,
      retakeAfterHours: test.retakeAfterHours,
      questionCount: test.questions.filter((q) => !q.archivedAt).length,
    },
    ...siipGate(graduate, test),
    videos: videosOf(test.id).map(({ assessmentId: _a, createdAt: _c, ...v }) => ({
      ...v,
      watchedAt: watchedAt(v.id, graduate.id),
    })),
    attempts: db.attempts
      .filter((t) => t.assessmentId === test.id && t.graduateId === graduate.id)
      .sort((a, b) => b.attemptNumber - a.attemptNumber)
      .map((t) => ({
        id: t.id,
        attemptNumber: t.attemptNumber,
        status: t.status,
        percentage: t.percentage,
        passed: t.passed,
        startedAt: t.startedAt,
        submittedAt: t.submittedAt,
      })),
  };
}

export function markVideoWatched(videoId: string) {
  const { graduate } = requireGraduate();
  if (!db.videos.some((v) => v.id === videoId)) throw notFound("Video");
  const key = `${videoId}:${graduate.id}`;
  if (!db.videoWatches.has(key)) db.videoWatches.set(key, new Date().toISOString());
  return getMySiipTest();
}

// ─── Admin ────────────────────────────────────────────────────────────────────

function requireTest() {
  const test = siipTest();
  if (!test) throw notFound("SIIP test");
  return test;
}

export function getSiipTestAdmin(): SiipTestAdmin {
  requireAdmin();
  const t = requireTest();
  const attempts = db.attempts.filter((a) => a.assessmentId === t.id);
  const live = t.questions.filter((q) => !q.archivedAt).sort((a, b) => a.order - b.order);
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    passMark: t.passMark,
    timeLimitMinutes: t.timeLimitMinutes,
    retakeAfterHours: t.retakeAfterHours,
    unlockAfterWeeks: t.unlockAfterWeeks,
    minCheckInRating: t.minCheckInRating,
    published: t.published,
    videos: videosOf(t.id).map(({ assessmentId: _a, createdAt: _c, ...v }) => ({
      ...v,
      watchCount: [...db.videoWatches.keys()].filter((k) => k.startsWith(`${v.id}:`)).length,
      questionCount: live.filter((q) => q.videoId === v.id).length,
    })),
    questions: live.map(({ archivedAt: _x, ...q }) => q),
    stats: {
      attempts: attempts.filter((a) => a.status !== "IN_PROGRESS").length,
      passed: attempts.filter((a) => a.passed).length,
    },
  };
}

export function createVideo(input: z.input<typeof testVideoSchema>) {
  const admin = requireAdmin();
  const t = requireTest();
  const v = testVideoSchema.parse(input);
  const video = {
    id: newId("vid"),
    assessmentId: t.id,
    title: v.title,
    description: v.description ?? null,
    youtubeId: v.youtubeUrl ?? null,
    order: Math.max(0, ...videosOf(t.id).map((x) => x.order)) + 1,
    createdAt: iso(0),
  };
  db.videos.push(video);
  audit(admin.id, "siip_video.created", "TestVideo", video.id, null, { title: video.title });
  return video;
}

export function updateVideo(id: string, input: z.input<typeof updateTestVideoSchema>) {
  const admin = requireAdmin();
  const video = db.videos.find((v) => v.id === id);
  if (!video) throw notFound("Video");
  const v = updateTestVideoSchema.parse(input);
  if (v.title !== undefined) video.title = v.title;
  if (v.description !== undefined) video.description = v.description ?? null;
  if (v.youtubeUrl !== undefined) video.youtubeId = v.youtubeUrl ?? null;
  audit(admin.id, "siip_video.updated", "TestVideo", id, null, { title: video.title, youtubeId: video.youtubeId });
  return video;
}

export function deleteVideo(id: string) {
  const admin = requireAdmin();
  if (!db.videos.some((v) => v.id === id)) throw notFound("Video");
  db.videos = db.videos.filter((v) => v.id !== id);
  for (const a of db.assessments) for (const q of a.questions) if (q.videoId === id) q.videoId = null;
  audit(admin.id, "siip_video.deleted", "TestVideo", id);
  return { deleted: true };
}

export function reorderVideos(ids: string[]) {
  const admin = requireAdmin();
  const t = requireTest();
  const known = new Set(videosOf(t.id).map((v) => v.id));
  if (ids.length !== known.size || !ids.every((id) => known.has(id)) || new Set(ids).size !== ids.length) {
    throw badRequest("Send every video exactly once, in the new order");
  }
  ids.forEach((id, i) => (db.videos.find((v) => v.id === id)!.order = i + 1));
  audit(admin.id, "siip_video.reordered", "Assessment", t.id);
  return videosOf(t.id);
}
