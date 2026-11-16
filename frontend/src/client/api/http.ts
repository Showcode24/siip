// Every request goes to the backend's /api/v1 routes. In the browser these are
// same-origin and proxied to the backend (next.config.ts), so auth cookies stay
// first-party and no CORS is needed.

/** Same shape as the backend's AppError responses. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface Envelope<T> {
  data: T;
  error: { code: string; message: string; details?: unknown } | null;
  meta: Record<string, unknown> | null;
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>;

function toSearch(query?: Query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Calls the real backend and unwraps `{ data, error, meta }`. */
export async function request<T>(
  method: string,
  path: string,
  opts: { body?: unknown; query?: Query } = {},
): Promise<Envelope<T>> {
  const res = await fetch(`/api/v1${path}${toSearch(opts.query)}`, {
    method,
    credentials: "include",
    headers: opts.body === undefined ? undefined : { "content-type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json || json.error) {
    const e = json?.error;
    throw new ApiError(
      e?.code ?? "INTERNAL_ERROR",
      e?.message ?? "Something went wrong. Please try again.",
      res.status,
      e?.details,
    );
  }
  return json;
}

/** Helper for endpoints that return a plain value: unwraps `data`. */
export async function call<T>(real: () => Promise<Envelope<T>>): Promise<T> {
  return (await real()).data;
}

/** Page result for list endpoints (cursor in meta.nextCursor). */
export async function callPage<T>(
  real: () => Promise<Envelope<T[]>>,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const res = await real();
  return { items: res.data, nextCursor: (res.meta?.nextCursor as string | null) ?? null };
}

export const get = <T>(path: string, query?: Query) => request<T>("GET", path, { query });
export const post = <T>(path: string, body: unknown = {}) => request<T>("POST", path, { body });
export const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, { body });
export const put = <T>(path: string, body: unknown) => request<T>("PUT", path, { body });
export const del = <T>(path: string) => request<T>("DELETE", path);

/** Human message for any thrown value (for toasts and inline errors). */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Something went wrong. Please try again.";
}
