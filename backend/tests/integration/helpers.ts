import { NextRequest } from "next/server";

type Handler<P> = (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;

/** Calls a route handler directly, like Next.js would. */
export async function call<P extends Record<string, string>>(
  handler: Handler<P>,
  opts: {
    method?: string;
    path?: string;
    body?: unknown;
    cookie?: string;
    params?: P;
  } = {},
) {
  const headers = new Headers({ "content-type": "application/json", origin: "http://localhost:3000" });
  if (opts.cookie) headers.set("cookie", opts.cookie);
  const req = new NextRequest(new URL(opts.path ?? "/", "http://localhost:3000"), {
    method: opts.method ?? "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(req, { params: Promise.resolve((opts.params ?? {}) as P) });
  const json = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  return { res, json };
}

/** Turns Set-Cookie headers into a Cookie request header. */
export function cookieFrom(res: Response) {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
