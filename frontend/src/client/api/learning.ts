// Training (courses, lessons, progress) and assessments (exams), graduate + admin.
import type { z } from "zod";
import type {
  createAssessmentSchema,
  questionSchema,
  testVideoSchema,
  updateAssessmentSchema,
  updateTestVideoSchema,
  AnswerInput,
} from "@siip/shared/validators/assessment";
import type {
  createCourseSchema,
  lessonSchema,
  moduleSchema,
  updateCourseSchema,
  updateLessonSchema,
} from "@siip/shared/validators/training";
import { call, callPage, del, get, patch, post, put } from "./http";
import type {
  AdminAssessment,
  AdminCourse,
  AdminLesson,
  AdminQuestion,
  AttemptRow,
  AttemptView,
  Lesson,
  MyAssessment,
  MySiipTest,
  MyTraining,
  Progress,
  SiipTestAdmin,
  SiipVideo,
} from "./types";

export const trainingApi = {
  getMyTraining: () => call(() => get<MyTraining>("/graduate/training")),
  getMyProgress: () =>
    call(() =>
      get<Progress & { courses: Array<Progress & { id: string; title: string }> }>(
        "/graduate/training/progress",
      ),
    ),
  getLesson: (id: string) => call(() => get<Lesson>(`/graduate/training/lessons/${id}`)),
  completeLesson: (id: string) => call(() => post<Progress>(`/graduate/training/lessons/${id}/complete`)),

  // Admin
  listCourses: (cohortId?: string) => call(() => get<AdminCourse[]>("/admin/courses", { cohortId })),
  getCourse: (id: string) => call(() => get<AdminCourse>(`/admin/courses/${id}`)),
  createCourse: (input: z.input<typeof createCourseSchema>) =>
    call(() => post<AdminCourse>("/admin/courses", input)),
  updateCourse: (id: string, input: z.input<typeof updateCourseSchema>) =>
    call(() => patch<AdminCourse>(`/admin/courses/${id}`, input)),
  deleteCourse: (id: string) => call(() => del<{ id: string }>(`/admin/courses/${id}`)),
  createModule: (courseId: string, input: z.input<typeof moduleSchema>) =>
    call(() => post<{ id: string }>(`/admin/courses/${courseId}/modules`, input)),
  updateModule: (id: string, input: Partial<z.input<typeof moduleSchema>>) =>
    call(() => patch<{ id: string }>(`/admin/modules/${id}`, input)),
  deleteModule: (id: string) => call(() => del<{ id: string }>(`/admin/modules/${id}`)),
  createLesson: (moduleId: string, input: z.input<typeof lessonSchema>) =>
    call(() => post<AdminLesson>(`/admin/modules/${moduleId}/lessons`, input)),
  updateLesson: (id: string, input: z.input<typeof updateLessonSchema>) =>
    call(() => patch<AdminLesson>(`/admin/lessons/${id}`, input)),
  deleteLesson: (id: string) => call(() => del<{ id: string }>(`/admin/lessons/${id}`)),
};

export const assessmentApi = {
  listMine: () => call(() => get<MyAssessment[]>("/graduate/assessments")),
  start: (assessmentId: string) =>
    call(() => post<AttemptView>(`/graduate/assessments/${assessmentId}/attempts`)),
  getAttempt: (id: string) => call(() => get<AttemptView>(`/graduate/attempts/${id}`)),
  saveAnswers: (id: string, answers: AnswerInput[]) =>
    call(() => put<{ saved: number; deadlineAt: string }>(`/graduate/attempts/${id}/answers`, { answers })),
  submit: (id: string, answers: AnswerInput[]) =>
    call(() => post<AttemptView>(`/graduate/attempts/${id}/submit`, { answers })),

  // Admin
  list: () => call(() => get<AdminAssessment[]>("/admin/assessments")),
  get: (id: string) => call(() => get<AdminAssessment>(`/admin/assessments/${id}`)),
  create: (input: z.input<typeof createAssessmentSchema>) =>
    call(() => post<AdminAssessment>("/admin/assessments", input)),
  update: (id: string, input: z.input<typeof updateAssessmentSchema>) =>
    call(() => patch<AdminAssessment>(`/admin/assessments/${id}`, input)),
  remove: (id: string) => call(() => del<{ id: string }>(`/admin/assessments/${id}`)),
  addQuestion: (id: string, input: z.input<typeof questionSchema>) =>
    call(() => post<AdminQuestion>(`/admin/assessments/${id}/questions`, input)),
  replaceQuestion: (qid: string, input: z.input<typeof questionSchema>) =>
    call(() => put<AdminQuestion>(`/admin/questions/${qid}`, input)),
  deleteQuestion: (qid: string) => call(() => del<{ id: string }>(`/admin/questions/${qid}`)),
  listAttempts: (id: string) =>
    callPage(() => get<AttemptRow[]>(`/admin/assessments/${id}/attempts`, { limit: 100 })),
  grantRetake: (id: string, graduateId: string, reason?: string) =>
    call(() => post<{ extraAttempts: number }>(`/admin/assessments/${id}/retakes`, { graduateId, reason })),
};

/** The SIIP test: videos, then a workplace-conduct quiz. */
export const siipTestApi = {
  getMine: () => call(() => get<MySiipTest | null>("/graduate/siip-test")),
  markWatched: (videoId: string) =>
    call(() => post<MySiipTest>(`/graduate/siip-test/videos/${videoId}/watched`)),

  // Admin
  getAdmin: () => call(() => get<SiipTestAdmin>("/admin/siip-test")),
  createVideo: (input: z.input<typeof testVideoSchema>) =>
    call(() => post<SiipVideo>("/admin/siip-test/videos", input)),
  updateVideo: (id: string, input: z.input<typeof updateTestVideoSchema>) =>
    call(() => patch<SiipVideo>(`/admin/siip-test/videos/${id}`, input)),
  deleteVideo: (id: string) => call(() => del<{ deleted: true }>(`/admin/siip-test/videos/${id}`)),
  reorderVideos: (ids: string[]) => call(() => post<SiipVideo[]>("/admin/siip-test/videos/reorder", { ids })),
};
