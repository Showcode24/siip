import { requireUser } from "@/server/auth/session";
import { handle, ok, parseJson, withAuthCookies } from "@/server/lib/http";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import { changePassword } from "@/server/services/auth.service";
import { changePasswordSchema } from "@/server/validators/auth";

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  await enforceRateLimit("passwordChange", user.id);
  const input = await parseJson(req, changePasswordSchema);
  const { headers } = await changePassword(input, req.headers);
  return withAuthCookies(ok({ message: "Password changed. Other devices have been signed out." }), headers);
});
