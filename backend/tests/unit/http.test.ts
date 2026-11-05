import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { toAppError } from "@/server/lib/http";
import { redact } from "@/server/lib/logger";

describe("toAppError", () => {
  it("passes AppErrors through", () => {
    const err = new AppError("NOT_FOUND", "Cohort not found");
    expect(toAppError(err)).toBe(err);
  });

  it("turns Zod errors into 422 with field paths", () => {
    const result = z.object({ email: z.email() }).safeParse({ email: "nope" });
    const err = toAppError(result.error);
    expect(err.status).toBe(422);
    expect(err.details).toEqual([expect.objectContaining({ path: "email" })]);
  });

  it("maps a Prisma unique violation to 409 without leaking details", () => {
    const prismaErr = Object.assign(new Error("Unique constraint failed on (`email`)"), {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
    });
    const err = toAppError(prismaErr);
    expect(err.status).toBe(409);
    expect(err.message).not.toContain("email");
  });

  it("hides unknown errors behind a generic 500", () => {
    const err = toAppError(new Error("connection string postgres://secret"));
    expect(err.status).toBe(500);
    expect(err.message).not.toContain("secret");
  });
});

describe("redact", () => {
  it("removes personal data from log context, recursively", () => {
    expect(
      redact({
        userId: "u1",
        email: "a@b.com",
        nested: { phone: "080", status: "ok" },
        list: [{ firstName: "Ada" }],
      }),
    ).toEqual({
      userId: "u1",
      email: "[redacted]",
      nested: { phone: "[redacted]", status: "ok" },
      list: [{ firstName: "[redacted]" }],
    });
  });
});
