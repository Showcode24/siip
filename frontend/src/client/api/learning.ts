// Training (courses, lessons, progress) and assessments (exams), graduate + admin.
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
  MyTraining,
  Progress,
} from "./types";

const m = () => import("../mocks/learning");

export const trainingApi = {
  getMyTraining: () =>
    call(
      () => get<MyTraining>("/graduate/training"),
      async () => (await m()).getMyTraining(),
      { read: true },
    ),
  getMyProgress: () =>
    call(
      () =>
        get<Progress & { courses: Array<Progress & { id: string; title: string }> }>(
          "/graduate/training/progress",
        ),
      async () => (await m()).getMyProgress(),
      { read: true },
    ),
  getLesson: (id: string) =>
    call(
      () => get<Lesson>(`/graduate/training/lessons/${id}`),
      async () => (await m()).getLesson(id),
      { read: true },
    ),
  completeLesson: (id: string) =>
    call(
      () => post<Progress>(`/graduate/training/lessons/${id}/complete`),
      async () => (await m()).completeLesson(id),
    ),

  // Admin
  listCourses: (cohortId?: string) =>
    call(
      () => get<AdminCourse[]>("/admin/courses", { cohortId }),
      async () => (await m()).listCourses(cohortId),
      { read: true },
    ),
  getCourse: (id: string) =>
    call(
      () => get<AdminCourse>(`/admin/courses/${id}`),
      async () => (await m()).getCourse(id),
      { read: true },
    ),
  createCourse: (input: z.input<typeof createCourseSchema>) =>
    call(
      () => post<AdminCourse>("/admin/courses", input),
      async () => (await m()).createCourse(input),
    ),
  updateCourse: (id: string, input: z.input<typeof updateCourseSchema>) =>
    call(
      () => patch<AdminCourse>(`/admin/courses/${id}`, input),
      async () => (await m()).updateCourse(id, input),
    ),
  deleteCourse: (id: string) =>
    call(
      () => del<{ id: string }>(`/admin/courses/${id}`),
      async () => (await m()).deleteCourse(id),
    ),
  createModule: (courseId: string, input: z.input<typeof moduleSchema>) =>
    call(
      () => post<{ id: string }>(`/admin/courses/${courseId}/modules`, input),
      async () => (await m()).createModule(courseId, input),
    ),
  updateModule: (id: string, input: Partial<z.input<typeof moduleSchema>>) =>
    call(
      () => patch<{ id: string }>(`/admin/modules/${id}`, input),
      async () => (await m()).updateModule(id, input),
    ),
  deleteModule: (id: string) =>
    call(
      () => del<{ id: string }>(`/admin/modules/${id}`),
      async () => (await m()).deleteModule(id),
    ),
  createLesson: (moduleId: string, input: z.input<typeof lessonSchema>) =>
    call(
      () => post<AdminLesson>(`/admin/modules/${moduleId}/lessons`, input),
      async () => (await m()).createLesson(moduleId, input),
    ),
  updateLesson: (id: string, input: z.input<typeof updateLessonSchema>) =>
    call(
      () => patch<AdminLesson>(`/admin/lessons/${id}`, input),
      async () => (await m()).updateLesson(id, input),
    ),
  deleteLesson: (id: string) =>
    call(
      () => del<{ id: string }>(`/admin/lessons/${id}`),
      async () => (await m()).deleteLesson(id),
    ),
};

export const assessmentApi = {
  listMine: () =>
    call(
      () => get<MyAssessment[]>("/graduate/assessments"),
      async () => (await m()).listMyAssessments(),
      { read: true },
    ),
  start: (assessmentId: string) =>
    call(
      () => post<AttemptView>(`/graduate/assessments/${assessmentId}/attempts`),
      async () => (await m()).startAttempt(assessmentId),
    ),
  getAttempt: (id: string) =>
    call(
      () => get<AttemptView>(`/graduate/attempts/${id}`),
      async () => (await m()).getAttempt(id),
    ),
  saveAnswers: (id: string, answers: AnswerInput[]) =>
    call(
      () => put<{ saved: number; deadlineAt: string }>(`/graduate/attempts/${id}/answers`, { answers }),
      async () => (await m()).saveAnswers(id, answers),
    ),
  submit: (id: string, answers: AnswerInput[]) =>
    call(
      () => post<AttemptView>(`/graduate/attempts/${id}/submit`, { answers }),
      async () => (await m()).submitAttempt(id, answers),
    ),

  // Admin
  list: () =>
    call(
      () => get<AdminAssessment[]>("/admin/assessments"),
      async () => (await m()).listAssessments(),
      { read: true },
    ),
  get: (id: string) =>
    call(
      () => get<AdminAssessment>(`/admin/assessments/${id}`),
      async () => (await m()).getAssessment(id),
      { read: true },
    ),
  create: (input: z.input<typeof createAssessmentSchema>) =>
    call(
      () => post<AdminAssessment>("/admin/assessments", input),
      async () => (await m()).createAssessment(input),
    ),
  update: (id: string, input: z.input<typeof updateAssessmentSchema>) =>
    call(
      () => patch<AdminAssessment>(`/admin/assessments/${id}`, input),
      async () => (await m()).updateAssessment(id, input),
    ),
  remove: (id: string) =>
    call(
      () => del<{ id: string }>(`/admin/assessments/${id}`),
      async () => (await m()).deleteAssessment(id),
    ),
  addQuestion: (id: string, input: z.input<typeof questionSchema>) =>
    call(
      () => post<AdminQuestion>(`/admin/assessments/${id}/questions`, input),
      async () => (await m()).addQuestion(id, input),
    ),
  replaceQuestion: (qid: string, input: z.input<typeof questionSchema>) =>
    call(
      () => put<AdminQuestion>(`/admin/questions/${qid}`, input),
      async () => (await m()).replaceQuestion(qid, input),
    ),
  deleteQuestion: (qid: string) =>
    call(
      () => del<{ id: string }>(`/admin/questions/${qid}`),
      async () => (await m()).deleteQuestion(qid),
    ),
  listAttempts: (id: string) =>
    callPage(
      () => get<AttemptRow[]>(`/admin/assessments/${id}/attempts`, { limit: 100 }),
      async () => (await m()).listAttempts(id),
    ),
  grantRetake: (id: string, graduateId: string, reason?: string) =>
    call(
      () => post<{ extraAttempts: number }>(`/admin/assessments/${id}/retakes`, { graduateId, reason }),
      async () => (await m()).grantRetake(id, graduateId),
    ),
};
