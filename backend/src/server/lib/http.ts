import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType, type z } from "zod";
import { AppError, errors } from "./errors";
import { describeError, logger } from "./logger";

export type ApiMeta = Record<string, unknown>;

export interface ApiBody<T> {
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta: ApiMeta | null;
}

export function ok<T>(data: T, meta?: ApiMeta, init?: ResponseInit): NextResponse<ApiBody<T>> {
  return NextResponse.json({ data, error: null, meta: meta ?? null }, init);
}

export function created<T>(data: T, meta?: ApiMeta): NextResponse<ApiBody<T>> {
  return ok(data, meta, { status: 201 });
}

function errorResponse(err: AppError): NextResponse<ApiBody<null>> {
  return NextResponse.json(
    {
      data: null,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      meta: null,
    },
    {
      status: err.status,
      headers:
        err.details && "retryAfterSeconds" in err.details
          ? { "retry-after": String(err.details.retryAfterSeconds) }
          : undefined,
    },
  );
}

/** Maps known Prisma errors to safe AppErrors without leaking internals. */
function fromPrismaError(err: unknown): AppError | null {
  if (!err || typeof err !== "object" || !("code" in err)) return null;
  const { code, name } = err as { code: unknown; name?: unknown };
  if (name !== "PrismaClientKnownRequestError" || typeof code !== "string") return null;
  if (code === "P2002") return errors.conflict("A record with these details already exists");
  if (code === "P2025") return errors.notFound();
  if (code === "P2003") return errors.badRequest("A related record does not exist");
  return null;
}

export function zodToAppError(err: ZodError): AppError {
  return new AppError(
    "VALIDATION_ERROR",
    "Some fields are invalid",
    err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return zodToAppError(err);
  const prismaError = fromPrismaError(err);
  if (prismaError) return prismaError;
  return new AppError("INTERNAL_ERROR", "Something went wrong. Please try again.");
}

export interface RouteContext<P extends Record<string, string> = Record<string, string>> {
  params: Promise<P>;
}

type Handler<P extends Record<string, string>> = (
  req: NextRequest,
  ctx: RouteContext<P>,
) => Promise<Response>;

/** Wraps a route handler so every failure becomes a `{ data, error, meta }` response. */
export function handle<P extends Record<string, string> = Record<string, string>>(
  fn: Handler<P>,
): Handler<P> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      const appError = toAppError(err);
      if (appError.status >= 500) {
        logger.error("Unhandled API error", {
          method: req.method,
          path: req.nextUrl.pathname,
          ...describeError(err),
        });
      }
      return errorResponse(appError);
    }
  };
}

export async function parseJson<S extends ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw errors.badRequest("Request body must be valid JSON");
  }
  return parseWith(schema, body);
}

export function parseQuery<S extends ZodType>(req: NextRequest, schema: S): z.infer<S> {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(req.nextUrl.searchParams.keys())) {
    const all = req.nextUrl.searchParams.getAll(key);
    raw[key] = all.length > 1 ? all : all[0];
  }
  return parseWith(schema, raw);
}

export function parseWith<S extends ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw zodToAppError(result.error);
  return result.data;
}

/** Copies Set-Cookie headers from a Better Auth call onto our response. */
export function withAuthCookies<R extends Response>(res: R, authHeaders: Headers | null | undefined): R {
  for (const cookie of authHeaders?.getSetCookie() ?? []) res.headers.append("set-cookie", cookie);
  return res;
}
