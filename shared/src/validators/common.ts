import { z } from "zod";
import { normalisePhone } from "../phone";

/** Route `[id]` params. cuids are ~25 chars; the cap just rejects junk early. */
export const idParam = z.object({ id: z.string().min(1).max(64) });

/** A phone number, normalised to +countrycode form. Optional: empty becomes null. */
export const phoneNumber = z
  .string()
  .trim()
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const normalised = normalisePhone(v);
    if (!normalised) {
      ctx.addIssue({ code: "custom", message: "Enter the number with its country code, e.g. +234 803 000 0000" });
      return z.NEVER;
    }
    return normalised;
  });

/** A phone number that must be given, normalised to +countrycode form. */
export const requiredPhoneNumber = z
  .string({ error: "Enter a phone number" })
  .trim()
  .min(1, "Enter a phone number")
  .transform((v, ctx) => {
    const normalised = normalisePhone(v);
    if (!normalised) {
      ctx.addIssue({ code: "custom", message: "Enter the number with its country code, e.g. +234 803 000 0000" });
      return z.NEVER;
    }
    return normalised;
  });

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
