import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/server/env";
import { AppError } from "./errors";
import { logger } from "./logger";

/** Limits per key (IP for anonymous routes, user id for signed-in ones). */
export const LIMITS = {
  signIn: { requests: 10, window: "10 m" },
  signUp: { requests: 5, window: "1 h" },
  passwordReset: { requests: 5, window: "1 h" },
  verificationEmail: { requests: 5, window: "1 h" },
  upload: { requests: 20, window: "1 h" },
  examSave: { requests: 120, window: "1 m" },
  examSubmit: { requests: 10, window: "1 m" },
  examStart: { requests: 10, window: "10 m" },
  certificateVerify: { requests: 30, window: "1 m" },
  dataExport: { requests: 5, window: "1 d" },
} as const satisfies Record<string, { requests: number; window: Duration }>;

export type LimitName = keyof typeof LIMITS;

interface Limiter {
  limit(key: string): Promise<{ success: boolean; reset: number }>;
}

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

export function windowMs(window: Duration): number {
  const [n, unit] = window.split(" ") as [string, keyof typeof UNIT_MS];
  return Number(n) * UNIT_MS[unit];
}

/** Fixed-window limiter for local development (per process, not shared). */
export function memoryLimiter(requests: number, ms: number): Limiter {
  const hits = new Map<string, { count: number; reset: number }>();
  return {
    async limit(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.reset <= now) {
        hits.set(key, { count: 1, reset: now + ms });
        return { success: true, reset: now + ms };
      }
      entry.count++;
      return { success: entry.count <= requests, reset: entry.reset };
    },
  };
}

const limiters = new Map<LimitName, Limiter>();
let redis: Redis | null | undefined;
let warned = false;

function limiterFor(name: LimitName): Limiter {
  const existing = limiters.get(name);
  if (existing) return existing;
  const { requests, window } = LIMITS[name];
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = env();
  redis ??= url && token ? new Redis({ url, token }) : null;
  let limiter: Limiter;
  if (redis) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `siip:rl:${name}`,
      analytics: false,
    });
  } else {
    if (!warned) logger.warn("Upstash not configured: using in-memory rate limits");
    warned = true;
    limiter = memoryLimiter(requests, windowMs(window));
  }
  limiters.set(name, limiter);
  return limiter;
}

/** Client IP as reported by Vercel's proxy. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
  );
}

/** Tests turn limits on explicitly so normal integration tests aren't throttled. */
const enabled = () => process.env.NODE_ENV !== "test" || process.env.RATE_LIMIT_IN_TESTS === "1";

/** Throws RATE_LIMITED (429) when `key` has used up its allowance for `name`. */
export async function enforceRateLimit(name: LimitName, key: string): Promise<void> {
  if (!enabled()) return;
  const { success, reset } = await limiterFor(name).limit(key);
  if (!success) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please try again shortly.", {
      retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
    });
  }
}

/** Test helper: forget limiter instances (e.g. after changing env). */
export function resetRateLimiters() {
  limiters.clear();
}
