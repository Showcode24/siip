import { z } from "zod";

/** Route `[id]` params. cuids are ~25 chars; the cap just rejects junk early. */
export const idParam = z.object({ id: z.string().min(1).max(64) });

/** Optional trimmed text; empty strings become null so fields can be cleared. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** A query param that may be repeated (?s=A&s=B) or comma-separated (?s=A,B). */
export function listParam<T extends z.ZodType>(item: T) {
  return z.preprocess((v) => {
    if (v === undefined || v === "") return undefined;
    const values = Array.isArray(v) ? v : [v];
    return values.flatMap((x) => String(x).split(",")).filter(Boolean);
  }, z.array(item).max(20).optional());
}

export const booleanParam = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");
