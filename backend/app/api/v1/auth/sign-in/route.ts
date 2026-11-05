import { handle, ok, parseJson, withAuthCookies } from "@/server/lib/http";
import { signIn } from "@/server/services/auth.service";
import { signInSchema } from "@/server/validators/auth";
import { clientIp, enforceRateLimit } from "@/server/lib/rate-limit";

export const POST = handle(async (req) => {
  await enforceRateLimit("signIn", clientIp(req));
  const input = await parseJson(req, signInSchema);
  const { user, headers } = await signIn(input, req.headers);
  return withAuthCookies(ok({ user }), headers);
});
