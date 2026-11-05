import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { getMe } from "@/server/services/auth.service";

export const GET = handle(async (req) => {
  const user = await requireUser(req);
  return ok(await getMe(user));
});
