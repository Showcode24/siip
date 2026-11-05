import { z } from "zod";

const title = z.string().trim().min(2).max(200);
const order = z.number().int().min(0).max(10_000);

export const courseListQuery = z.object({ cohortId: z.string().min(1).max(64).optional() });

export const createCourseSchema = z
  .object({
    cohortId: z.string().min(1).max(64),
    title,
    description: z.string().trim().max(5000).nullish(),
    order: order.optional(),
    published: z.boolean().optional(),
  })
  .strict();

export const updateCourseSchema = createCourseSchema.omit({ cohortId: true }).partial().strict();

export const moduleSchema = z.object({ title, order: order.optional() }).strict();
export const updateModuleSchema = moduleSchema.partial().strict();

export const lessonSchema = z
  .object({
    title,
    content: z.string().max(100_000).nullish(),
    videoUrl: z
      .url({ protocol: /^https$/ })
      .max(500)
      .nullish(),
    estimatedMinutes: z.number().int().min(1).max(600).nullish(),
    order: order.optional(),
  })
  .strict();
export const updateLessonSchema = lessonSchema.partial().strict();

export const lessonAttachmentSchema = z.object({ publicId: z.string().min(1).max(255) });
export const signAttachmentSchema = z.object({ extension: z.string().trim().toLowerCase().max(10) });
