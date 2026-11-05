import { db } from "@/server/db";
import { handle, ok } from "@/server/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await db.$queryRaw`SELECT 1`;
  return ok({ status: "ok", time: new Date().toISOString() });
});
