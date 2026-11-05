import type { z } from "zod";
import type {
  createAssessmentSchema,
  questionSchema,
  updateAssessmentSchema,
  AnswerInput,
} from "@siip/shared/validators/assessment";
import type {
  createCourseSchema,
  lessonSchema,
  moduleSchema,
  updateCourseSchema,
  updateLessonSchema,
} from "@siip/shared/validators/training";
import { ApiError } from "@/client/api/http";
import type { AdminAssessment, AdminCourse, AttemptView, MyAssessment, MyTraining } from "@/client/api/types";
import { audit, cohortById, db, newId, notify } from "./db";
import {
  badRequest,
  conflict,
  currentApplication,
  isoNow,
  notFound,
  requireAdmin,
  requireGraduate,
  scoreAttemptMock,
  transition,
} from "./logic";

const TRAINING_ACCESS = ["IN_TRAINING", "FINAL_ASSESSMENT", "QUALIFIED", "MATCHED", "PLACED", "COMPLETED"];
const progressOf = (completed: number, total: number) => ({
  completed,
  total,
  percent: total === 0 ? 0 : Math.round((completed / total) * 100),
});

function trainingApp() {
  const { graduate } = requireGraduate();
  const app = currentApplication(graduate.id);
  if (!app || !TRAINING_ACCESS.includes(app.status))
    throw new ApiError("FORBIDDEN", "Training opens once you are admitted to a cohort", 403);
  return { graduate, app };
}

export function getMyTraining(): MyTraining {
  const { graduate, app } = trainingApp();
  let done = 0,
    total = 0;
  const courses = db.courses
    .filter((c) => c.cohortId === app.cohortId && c.published)
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      let cd = 0,
        ct = 0;
      const modules = c.modules.map((mod) => ({
        id: mod.id,
        title: mod.title,
        lessons: mod.lessons.map((l) => {
          const completedAt = db.lessonProgress.get(`${graduate.id}:${l.id}`) ?? null;
          ct++;
          if (completedAt) cd++;
          return { id: l.id, title: l.title, estimatedMinutes: l.estimatedMinutes, completedAt };
        }),
      }));
      done += cd;
      total += ct;
      return { id: c.id, title: c.title, description: c.description, modules, progress: progressOf(cd, ct) };
    });
  return { applicationStatus: app.status, courses, progress: progressOf(done, total) };
}

export function getMyProgress() {
  const t = getMyTraining();
  return { ...t.progress, courses: t.courses.map((c) => ({ id: c.id, title: c.title, ...c.progress })) };
}

function findLesson(lessonId: string) {
  const { graduate, app } = trainingApp();
  for (const c of db.courses.filter((x) => x.cohortId === app.cohortId && x.published)) {
    for (const mod of c.modules) {
      const l = mod.lessons.find((x) => x.id === lessonId);
      if (l) return { graduate, app, course: c, mod, lesson: l };
    }
  }
  throw notFound("Lesson");
}

export function getLesson(id: string) {
  const { graduate, course, mod, lesson } = findLesson(id);
  return {
    id: lesson.id,
    title: lesson.title,
    content: lesson.content,
    videoUrl: lesson.videoUrl,
    attachmentUrl: lesson.attachmentUrl,
    estimatedMinutes: lesson.estimatedMinutes,
    module: { id: mod.id, title: mod.title, course: { id: course.id, title: course.title } },
    completedAt: db.lessonProgress.get(`${graduate.id}:${lesson.id}`) ?? null,
  };
}

export function completeLesson(id: string) {
  const { graduate, app } = findLesson(id);
  if (!db.lessonProgress.has(`${graduate.id}:${id}`)) db.lessonProgress.set(`${graduate.id}:${id}`, isoNow());
  const p = getMyTraining().progress;
  if (app.status === "IN_TRAINING" && p.total > 0 && p.completed === p.total)
    transition(app, "FINAL_ASSESSMENT", "SYSTEM", null);
  return p;
}

// ─── Admin: courses ───────────────────────────────────────────────────────────

const course = (id: string) => {
  const c = db.courses.find((x) => x.id === id);
  if (!c) throw notFound("Course");
  return c;
};
const findModule = (id: string) => {
  for (const c of db.courses) {
    const mod = c.modules.find((x) => x.id === id);
    if (mod) return { c, mod };
  }
  throw notFound("Module");
};
const findAdminLesson = (id: string) => {
  for (const c of db.courses)
    for (const mod of c.modules) {
      const l = mod.lessons.find((x) => x.id === id);
      if (l) return { mod, l };
    }
  throw notFound("Lesson");
};

export function listCourses(cohortId?: string) {
  requireAdmin();
  return db.courses.filter((c) => !cohortId || c.cohortId === cohortId);
}
export function getCourse(id: string) {
  requireAdmin();
  return course(id);
}
export function createCourse(input: z.input<typeof createCourseSchema>): AdminCourse {
  const admin = requireAdmin();
  if (!cohortById(input.cohortId)) throw notFound("Cohort");
  const c: AdminCourse = {
    id: newId("crs"),
    cohortId: input.cohortId,
    title: input.title,
    description: input.description ?? null,
    order: input.order ?? db.courses.length,
    published: input.published ?? false,
    modules: [],
  };
  db.courses.push(c);
  audit(admin.id, "course.created", "Course", c.id, null, { title: c.title });
  return c;
}
export function updateCourse(id: string, input: z.input<typeof updateCourseSchema>) {
  const admin = requireAdmin();
  const c = course(id);
  Object.assign(c, input);
  audit(admin.id, "course.updated", "Course", id);
  return c;
}
export function deleteCourse(id: string) {
  const admin = requireAdmin();
  course(id);
  db.courses = db.courses.filter((c) => c.id !== id);
  audit(admin.id, "course.deleted", "Course", id);
  return { id };
}
export function createModule(courseId: string, input: z.input<typeof moduleSchema>) {
  const admin = requireAdmin();
  const c = course(courseId);
  const mod = {
    id: newId("mod"),
    courseId,
    title: input.title,
    order: input.order ?? c.modules.length,
    lessons: [],
  };
  c.modules.push(mod);
  audit(admin.id, "module.created", "Module", mod.id);
  return { id: mod.id };
}
export function updateModule(id: string, input: Partial<z.input<typeof moduleSchema>>) {
  requireAdmin();
  Object.assign(findModule(id).mod, input);
  return { id };
}
export function deleteModule(id: string) {
  requireAdmin();
  const { c } = findModule(id);
  c.modules = c.modules.filter((x) => x.id !== id);
  return { id };
}
export function createLesson(moduleId: string, input: z.input<typeof lessonSchema>) {
  const admin = requireAdmin();
  const { mod } = findModule(moduleId);
  const l = {
    id: newId("les"),
    moduleId,
    title: input.title,
    content: input.content ?? null,
    videoUrl: input.videoUrl ?? null,
    attachmentUrl: null,
    estimatedMinutes: input.estimatedMinutes ?? null,
    order: input.order ?? mod.lessons.length,
  };
  mod.lessons.push(l);
  audit(admin.id, "lesson.created", "Lesson", l.id);
  return l;
}
export function updateLesson(id: string, input: z.input<typeof updateLessonSchema>) {
  requireAdmin();
  const { l } = findAdminLesson(id);
  Object.assign(l, input);
  return l;
}
export function deleteLesson(id: string) {
  requireAdmin();
  const { mod } = findAdminLesson(id);
  mod.lessons = mod.lessons.filter((x) => x.id !== id);
  return { id };
}

// ─── Graduate: assessments ────────────────────────────────────────────────────

const ELIGIBLE: Record<string, string[]> = {
  SCREENING: ["SUBMITTED", "SCREENING"],
  FINAL: ["FINAL_ASSESSMENT"],
};
const GRACE = 30_000;
const overdue = (deadline: string) => Date.now() > new Date(deadline).getTime() + GRACE;

export function listMyAssessments(): MyAssessment[] {
  const { graduate } = requireGraduate();
  const app = currentApplication(graduate.id);
  if (!app) return [];
  return db.assessments
    .filter((a) => a.published && (!a.cohortId || a.cohortId === app.cohortId))
    .map((a) => {
      const attempts = db.attempts
        .filter((t) => t.assessmentId === a.id && t.graduateId === graduate.id)
        .sort((x, y) => x.attemptNumber - y.attemptNumber);
      const allowed = a.maxAttempts + (db.retakeGrants.get(`${a.id}:${graduate.id}`) ?? 0);
      const inProgress = attempts.find((t) => t.status === "IN_PROGRESS" && !overdue(t.deadlineAt));
      const passed = attempts.some((t) => t.passed);
      const eligible = ELIGIBLE[a.type].includes(app.status);
      return {
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        timeLimitMinutes: a.timeLimitMinutes,
        passMark: a.passMark,
        maxAttempts: a.maxAttempts,
        questionCount: a.questions.length,
        attemptsAllowed: allowed,
        attemptsUsed: attempts.length,
        passed,
        inProgressAttemptId: inProgress?.id ?? null,
        canStart: eligible && !passed && (Boolean(inProgress) || attempts.length < allowed),
        attempts: attempts.map((t) => ({
          id: t.id,
          attemptNumber: t.attemptNumber,
          status: t.status,
          percentage: t.percentage,
          passed: t.passed,
        })),
      };
    });
}

const shuffle = <T>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5);

export function startAttempt(assessmentId: string): AttemptView {
  const { graduate } = requireGraduate();
  const mine = listMyAssessments().find((a) => a.id === assessmentId);
  if (!mine) throw notFound("Assessment");
  if (mine.inProgressAttemptId) return getAttempt(mine.inProgressAttemptId);
  if (mine.passed) throw conflict("You have already passed this assessment");
  if (!mine.canStart)
    throw conflict(
      mine.attemptsUsed >= mine.attemptsAllowed
        ? "You have no attempts left for this assessment"
        : "This assessment is not available at your current stage",
    );
  const a = db.assessments.find((x) => x.id === assessmentId)!;
  const qs = a.shuffleQuestions ? shuffle(a.questions) : a.questions;
  const now = Date.now();
  const t = {
    id: newId("att"),
    assessmentId,
    graduateId: graduate.id,
    attemptNumber: mine.attemptsUsed + 1,
    status: "IN_PROGRESS" as const,
    startedAt: new Date(now).toISOString(),
    deadlineAt: new Date(now + a.timeLimitMinutes * 60_000).toISOString(),
    submittedAt: null,
    layout: qs.map((q) => ({
      questionId: q.id,
      optionIds: (a.shuffleOptions ? shuffle(q.options) : q.options).map((o) => o.id),
    })),
    answers: {},
    score: null,
    maxScore: null,
    percentage: null,
    passed: null,
  };
  db.attempts.push(t);
  return getAttempt(t.id);
}

function ownAttempt(id: string) {
  const { graduate } = requireGraduate();
  const t = db.attempts.find((x) => x.id === id && x.graduateId === graduate.id);
  if (!t) throw notFound("Attempt");
  return t;
}

function finalize(id: string, status: "SUBMITTED" | "EXPIRED") {
  const t = db.attempts.find((x) => x.id === id)!;
  if (t.status !== "IN_PROGRESS") return;
  const r = scoreAttemptMock(id);
  Object.assign(t, {
    status,
    submittedAt: isoNow(),
    score: r.score,
    maxScore: r.max,
    percentage: r.percentage,
    passed: r.passed,
  });
  const a = db.assessments.find((x) => x.id === t.assessmentId)!;
  const g = db.graduates.find((x) => x.id === t.graduateId)!;
  notify(
    g.userId,
    "assessment.result",
    `${a.title}: ${r.passed ? "passed" : "result ready"}`,
    `You scored ${r.percentage}%.`,
    { attemptId: id },
  );
  const app = currentApplication(g.id);
  if (!app) return;
  if (a.type === "FINAL" && r.passed && app.status === "FINAL_ASSESSMENT")
    transition(app, "QUALIFIED", "SYSTEM", null);
  if (a.type === "SCREENING" && app.status === "SUBMITTED") transition(app, "SCREENING", "SYSTEM", null);
}

/** Questions without the answer key while in progress; score and pass/fail only once finished. */
export function getAttempt(id: string): AttemptView {
  let t = ownAttempt(id);
  if (t.status === "IN_PROGRESS" && overdue(t.deadlineAt)) {
    finalize(id, "EXPIRED");
    t = ownAttempt(id);
  }
  const a = db.assessments.find((x) => x.id === t.assessmentId)!;
  const base = {
    id: t.id,
    assessment: {
      id: a.id,
      title: a.title,
      type: a.type,
      passMark: a.passMark,
      timeLimitMinutes: a.timeLimitMinutes,
    },
    attemptNumber: t.attemptNumber,
    status: t.status,
    startedAt: t.startedAt,
    deadlineAt: t.deadlineAt,
  };
  if (t.status !== "IN_PROGRESS")
    return { ...base, submittedAt: t.submittedAt, result: { percentage: t.percentage, passed: t.passed } };
  return {
    ...base,
    serverTime: isoNow(),
    questions: t.layout.map((l) => {
      const q = a.questions.find((x) => x.id === l.questionId)!;
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        options: l.optionIds.map((oid) => {
          const o = q.options.find((x) => x.id === oid)!;
          return { id: o.id, text: o.text };
        }),
      };
    }),
    answers: Object.entries(t.answers).map(([questionId, v]) => ({ questionId, ...v })),
  };
}

function store(t: ReturnType<typeof ownAttempt>, answers: AnswerInput[]) {
  for (const ans of answers) {
    if (!t.layout.some((l) => l.questionId === ans.questionId))
      throw badRequest("An answer refers to a question not in this attempt");
    t.answers[ans.questionId] = {
      selectedOptionIds: ans.selectedOptionIds ?? [],
      textAnswer: ans.textAnswer ?? null,
    };
  }
}

export function saveAnswers(id: string, answers: AnswerInput[]) {
  const t = ownAttempt(id);
  if (t.status !== "IN_PROGRESS") throw conflict("This attempt has already ended");
  if (overdue(t.deadlineAt)) {
    finalize(id, "EXPIRED");
    throw conflict("Time is up. Your saved answers have been submitted.");
  }
  store(t, answers);
  return { saved: answers.length, deadlineAt: t.deadlineAt };
}

export function submitAttempt(id: string, answers: AnswerInput[] = []) {
  const t = ownAttempt(id);
  if (t.status === "IN_PROGRESS") {
    const late = overdue(t.deadlineAt);
    if (!late) store(t, answers);
    finalize(id, late ? "EXPIRED" : "SUBMITTED");
  }
  return getAttempt(id);
}

// ─── Admin: assessments ───────────────────────────────────────────────────────

const withCount = (a: (typeof db.assessments)[number]): AdminAssessment => ({
  ...a,
  _count: {
    questions: a.questions.length,
    attempts: db.attempts.filter((t) => t.assessmentId === a.id).length,
  },
});
const assessment = (id: string) => {
  const a = db.assessments.find((x) => x.id === id);
  if (!a) throw notFound("Assessment");
  return a;
};
const assertNoAttempts = (id: string) => {
  if (db.attempts.some((t) => t.assessmentId === id))
    throw conflict("This assessment already has attempts, so its questions can no longer change");
};

export function listAssessments() {
  requireAdmin();
  return db.assessments.map(withCount);
}
export function getAssessment(id: string) {
  requireAdmin();
  return withCount(assessment(id));
}
export function createAssessment(input: z.input<typeof createAssessmentSchema>) {
  const admin = requireAdmin();
  const a = {
    id: newId("asm"),
    cohortId: input.cohortId ?? null,
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    timeLimitMinutes: input.timeLimitMinutes,
    passMark: input.passMark,
    maxAttempts: input.maxAttempts ?? 1,
    shuffleQuestions: input.shuffleQuestions ?? true,
    shuffleOptions: input.shuffleOptions ?? true,
    published: false,
    createdAt: isoNow(),
    questions: [],
  };
  db.assessments.push(a);
  audit(admin.id, "assessment.created", "Assessment", a.id, null, { title: a.title });
  return withCount(a);
}
export function updateAssessment(id: string, input: z.input<typeof updateAssessmentSchema>) {
  const admin = requireAdmin();
  const a = assessment(id);
  if (input.passMark !== undefined && input.passMark !== a.passMark) assertNoAttempts(id);
  if (input.published && a.questions.length === 0)
    throw badRequest("Add at least one question before publishing");
  Object.assign(a, input);
  audit(admin.id, "assessment.updated", "Assessment", id);
  return withCount(a);
}
export function deleteAssessment(id: string) {
  requireAdmin();
  assertNoAttempts(id);
  db.assessments = db.assessments.filter((a) => a.id !== id);
  return { id };
}
function toQuestion(input: z.input<typeof questionSchema>, order: number) {
  return {
    id: newId("q"),
    type: input.type,
    prompt: input.prompt,
    points: input.points ?? 1,
    order: input.order ?? order,
    acceptedAnswers: input.acceptedAnswers ?? [],
    options: (input.options ?? []).map((o, i) => ({
      id: newId("opt"),
      text: o.text,
      isCorrect: o.isCorrect,
      order: i,
    })),
  };
}
export function addQuestion(id: string, input: z.input<typeof questionSchema>) {
  requireAdmin();
  const a = assessment(id);
  assertNoAttempts(id);
  const q = toQuestion(input, a.questions.length);
  a.questions.push(q);
  return q;
}
export function replaceQuestion(qid: string, input: z.input<typeof questionSchema>) {
  requireAdmin();
  const a = db.assessments.find((x) => x.questions.some((q) => q.id === qid));
  if (!a) throw notFound("Question");
  assertNoAttempts(a.id);
  const idx = a.questions.findIndex((q) => q.id === qid);
  a.questions[idx] = { ...toQuestion(input, idx), id: qid };
  return a.questions[idx];
}
export function deleteQuestion(qid: string) {
  requireAdmin();
  const a = db.assessments.find((x) => x.questions.some((q) => q.id === qid));
  if (!a) throw notFound("Question");
  assertNoAttempts(a.id);
  a.questions = a.questions.filter((q) => q.id !== qid);
  return { id: qid };
}
export function listAttempts(id: string) {
  requireAdmin();
  return db.attempts
    .filter((t) => t.assessmentId === id)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((t) => {
      const g = db.graduates.find((x) => x.id === t.graduateId)!;
      return {
        id: t.id,
        attemptNumber: t.attemptNumber,
        status: t.status,
        startedAt: t.startedAt,
        deadlineAt: t.deadlineAt,
        submittedAt: t.submittedAt,
        score: t.score,
        maxScore: t.maxScore,
        percentage: t.percentage,
        passed: t.passed,
        graduate: { id: g.id, firstName: g.firstName, lastName: g.lastName },
      };
    });
}
export function grantRetake(id: string, graduateId: string) {
  const admin = requireAdmin();
  const key = `${id}:${graduateId}`;
  db.retakeGrants.set(key, (db.retakeGrants.get(key) ?? 0) + 1);
  audit(admin.id, "assessment.retake_granted", "Assessment", id, null, { graduateId });
  return { extraAttempts: db.retakeGrants.get(key)! };
}
