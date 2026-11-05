import type { z } from "zod";
import { db, type Tx } from "@/server/db";
import { recordAudit, type AuditActor } from "@/server/lib/audit";
import { errors } from "@/server/lib/errors";
import { UPLOAD_KINDS, confirmUpload, createSignedUpload, deleteAsset } from "@/server/storage/cloudinary";
import type {
  createCourseSchema,
  lessonSchema,
  moduleSchema,
  updateCourseSchema,
  updateLessonSchema,
  updateModuleSchema,
} from "@/server/validators/training";
import { sendApplicationEmail, transitionApplication } from "./application.service";
import { requireTrainingAccess } from "./enrolment";

type In<S extends z.ZodType> = z.infer<S>;

/** Runs an admin change and its audit row in one transaction. */
async function audited<T extends { id: string }>(
  actor: AuditActor,
  action: string,
  entityType: string,
  change: (tx: Tx) => Promise<T>,
  after?: Record<string, unknown>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    const result = await change(tx);
    await recordAudit(tx, {
      actor,
      action,
      entityType,
      entityId: result.id,
      ...(after ? { after: JSON.parse(JSON.stringify(after)) } : {}),
    });
    return result;
  });
}

// ─── Admin: courses, modules, lessons ─────────────────────────────────────────

export function listCourses(cohortId?: string) {
  return db.course.findMany({
    where: cohortId ? { cohortId } : {},
    include: { _count: { select: { modules: true } } },
    orderBy: [{ cohortId: "asc" }, { order: "asc" }, { id: "asc" }],
  });
}

export async function getCourseForAdmin(courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        include: { lessons: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
      },
    },
  });
  if (!course) throw errors.notFound("Course");
  return course;
}

export async function createCourse(actor: AuditActor, input: In<typeof createCourseSchema>) {
  const cohort = await db.cohort.findUnique({ where: { id: input.cohortId }, select: { id: true } });
  if (!cohort) throw errors.notFound("Cohort");
  return audited(actor, "course.created", "Course", (tx) => tx.course.create({ data: input }), {
    title: input.title,
  });
}

export function updateCourse(actor: AuditActor, id: string, input: In<typeof updateCourseSchema>) {
  return audited(
    actor,
    "course.updated",
    "Course",
    (tx) => tx.course.update({ where: { id }, data: input }),
    input,
  );
}

export function deleteCourse(actor: AuditActor, id: string) {
  return audited(actor, "course.deleted", "Course", (tx) => tx.course.delete({ where: { id } }));
}

export async function createModule(actor: AuditActor, courseId: string, input: In<typeof moduleSchema>) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw errors.notFound("Course");
  return audited(
    actor,
    "module.created",
    "Module",
    (tx) => tx.module.create({ data: { ...input, courseId } }),
    {
      courseId,
    },
  );
}

export function updateModule(actor: AuditActor, id: string, input: In<typeof updateModuleSchema>) {
  return audited(
    actor,
    "module.updated",
    "Module",
    (tx) => tx.module.update({ where: { id }, data: input }),
    input,
  );
}

export function deleteModule(actor: AuditActor, id: string) {
  return audited(actor, "module.deleted", "Module", (tx) => tx.module.delete({ where: { id } }));
}

export async function createLesson(actor: AuditActor, moduleId: string, input: In<typeof lessonSchema>) {
  const mod = await db.module.findUnique({ where: { id: moduleId }, select: { id: true } });
  if (!mod) throw errors.notFound("Module");
  return audited(
    actor,
    "lesson.created",
    "Lesson",
    (tx) => tx.lesson.create({ data: { ...input, moduleId } }),
    {
      moduleId,
    },
  );
}

export function updateLesson(actor: AuditActor, id: string, input: In<typeof updateLessonSchema>) {
  return audited(
    actor,
    "lesson.updated",
    "Lesson",
    (tx) => tx.lesson.update({ where: { id }, data: input }),
    {
      fields: Object.keys(input),
    },
  );
}

export function deleteLesson(actor: AuditActor, id: string) {
  return audited(actor, "lesson.deleted", "Lesson", (tx) => tx.lesson.delete({ where: { id } }));
}

/** Lesson attachments are stored under the lesson's id. */
export async function signLessonAttachment(lessonId: string, extension: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) throw errors.notFound("Lesson");
  return createSignedUpload("lessonAttachment", lessonId, extension);
}

export async function attachLessonFile(actor: AuditActor, lessonId: string, publicId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { attachmentPublicId: true },
  });
  if (!lesson) throw errors.notFound("Lesson");
  const upload = await confirmUpload("lessonAttachment", lessonId, publicId);
  const updated = await audited(actor, "lesson.attachment_set", "Lesson", (tx) =>
    tx.lesson.update({
      where: { id: lessonId },
      data: { attachmentPublicId: upload.publicId, attachmentUrl: upload.url },
    }),
  );
  if (lesson.attachmentPublicId && lesson.attachmentPublicId !== upload.publicId) {
    const k = UPLOAD_KINDS.lessonAttachment;
    await deleteAsset(lesson.attachmentPublicId, k.resourceType, k.deliveryType);
  }
  return updated;
}

// ─── Graduate: content and progress ───────────────────────────────────────────

/** Published courses of the graduate's cohort, with per-lesson completion. */
export async function getMyTraining(graduateId: string) {
  const app = await requireTrainingAccess(graduateId);
  const courses = await db.course.findMany({
    where: { cohortId: app.cohortId, published: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      modules: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          lessons: {
            orderBy: [{ order: "asc" }, { id: "asc" }],
            select: {
              id: true,
              title: true,
              estimatedMinutes: true,
              progress: { where: { graduateId }, select: { completedAt: true } },
            },
          },
        },
      },
    },
  });

  let total = 0;
  let done = 0;
  const shaped = courses.map((c) => {
    let courseTotal = 0;
    let courseDone = 0;
    const modules = c.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map(({ progress, ...l }) => {
        const completedAt = progress[0]?.completedAt ?? null;
        courseTotal++;
        if (completedAt) courseDone++;
        return { ...l, completedAt };
      }),
    }));
    total += courseTotal;
    done += courseDone;
    return { ...c, modules, progress: progressOf(courseDone, courseTotal) };
  });
  return { applicationStatus: app.status, courses: shaped, progress: progressOf(done, total) };
}

function progressOf(completed: number, total: number) {
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

export async function getMyProgress(graduateId: string) {
  const { progress, courses } = await getMyTraining(graduateId);
  return {
    ...progress,
    courses: courses.map((c) => ({ id: c.id, title: c.title, ...c.progress })),
  };
}

/** A lesson the graduate may open: published course, their cohort. */
async function findAccessibleLesson(graduateId: string, lessonId: string) {
  const app = await requireTrainingAccess(graduateId);
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, module: { course: { cohortId: app.cohortId, published: true } } },
    select: {
      id: true,
      title: true,
      content: true,
      videoUrl: true,
      attachmentUrl: true,
      estimatedMinutes: true,
      module: { select: { id: true, title: true, course: { select: { id: true, title: true } } } },
      progress: { where: { graduateId }, select: { completedAt: true } },
    },
  });
  if (!lesson) throw errors.notFound("Lesson");
  return { app, lesson };
}

export async function getMyLesson(graduateId: string, lessonId: string) {
  const { lesson } = await findAccessibleLesson(graduateId, lessonId);
  const { progress, ...rest } = lesson;
  return { ...rest, completedAt: progress[0]?.completedAt ?? null };
}

/**
 * Marks a lesson complete (idempotent). When the last lesson of the cohort is
 * done, the application moves on to the final assessment automatically.
 */
export async function completeLesson(graduateId: string, lessonId: string) {
  const { app } = await findAccessibleLesson(graduateId, lessonId);

  const change = await db.$transaction(async (tx) => {
    await tx.lessonProgress.upsert({
      where: { lessonId_graduateId: { lessonId, graduateId } },
      update: {},
      create: { lessonId, graduateId },
    });
    if (app.status !== "IN_TRAINING") return null;

    const scope = { module: { course: { cohortId: app.cohortId, published: true } } };
    const [total, completed] = await Promise.all([
      tx.lesson.count({ where: scope }),
      tx.lessonProgress.count({ where: { graduateId, lesson: scope } }),
    ]);
    if (total === 0 || completed < total) return null;
    return transitionApplication(tx, {
      applicationId: app.id,
      to: "FINAL_ASSESSMENT",
      actor: "SYSTEM",
      auditActor: null,
    });
  });
  if (change) await sendApplicationEmail(change);
  return getMyProgress(graduateId);
}
