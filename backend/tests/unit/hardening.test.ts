import { readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import spec from "@/server/openapi/openapi.json";
import { enforceRateLimit, memoryLimiter, resetRateLimiters, windowMs } from "@/server/lib/rate-limit";

describe("rate limiting", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_IN_TESTS;
    resetRateLimiters();
  });

  it("allows up to the limit within a window, then blocks", async () => {
    const limiter = memoryLimiter(2, 60_000);
    expect((await limiter.limit("ip")).success).toBe(true);
    expect((await limiter.limit("ip")).success).toBe(true);
    expect((await limiter.limit("ip")).success).toBe(false);
    expect((await limiter.limit("other-ip")).success).toBe(true);
  });

  it("parses window durations", () => {
    expect(windowMs("10 m")).toBe(600_000);
    expect(windowMs("1 d")).toBe(86_400_000);
  });

  it("throws RATE_LIMITED with a retry hint once the allowance is used", async () => {
    process.env.RATE_LIMIT_IN_TESTS = "1";
    process.env.DATABASE_URL ??= "postgresql://unused";
    process.env.BETTER_AUTH_SECRET ??= "x".repeat(32);
    for (let i = 0; i < 10; i++) await enforceRateLimit("signIn", "1.2.3.4");
    await expect(enforceRateLimit("signIn", "1.2.3.4")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      details: { retryAfterSeconds: expect.any(Number) },
    });
  });
});

describe("OpenAPI spec", () => {
  it("documents every route handler (run `pnpm openapi` if this fails)", () => {
    const apiDir = path.resolve("app/api/v1");
    const routes = (readdirSync(apiDir, { recursive: true }) as string[])
      .filter((f) => f.endsWith("route.ts"))
      .map((f) => `/api/v1/${path.dirname(f).split(path.sep).join("/")}`.replace(/\[(\w+)\]/g, "{$1}"));
    const documented = Object.keys(spec.paths);
    expect(routes.filter((r) => !documented.includes(r))).toEqual([]);
  });
});

describe("shared enums", () => {
  it("match Prisma's generated enums (run `pnpm db:generate` if this fails)", async () => {
    const { readFileSync } = await import("node:fs");
    const body = (file: string) => readFileSync(file, "utf8").replace(/^[\s\S]*?(?=export const)/, "");
    expect(body("../shared/src/enums.ts")).toBe(body("src/generated/prisma/enums.ts"));
  });
});
