export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "EMAIL_NOT_VERIFIED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  EMAIL_NOT_VERIFIED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export type ErrorDetails = Record<string, unknown> | Array<Record<string, unknown>>;

/** An error whose message is safe to show to API clients. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetails;

  constructor(code: ErrorCode, message: string, details?: ErrorDetails) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const errors = {
  badRequest: (message = "Bad request", details?: ErrorDetails) =>
    new AppError("BAD_REQUEST", message, details),
  unauthenticated: (message = "You need to sign in") => new AppError("UNAUTHENTICATED", message),
  forbidden: (message = "You do not have permission to do this") => new AppError("FORBIDDEN", message),
  notFound: (what = "Resource") => new AppError("NOT_FOUND", `${what} not found`),
  conflict: (message: string, details?: ErrorDetails) => new AppError("CONFLICT", message, details),
  rateLimited: () => new AppError("RATE_LIMITED", "Too many requests. Please try again shortly."),
};
