import { created, handle, parseJson } from "@/server/lib/http";
import { signUp } from "@/server/services/auth.service";
import { signUpSchema } from "@/server/validators/auth";
import { clientIp, enforceRateLimit } from "@/server/lib/rate-limit";

export const POST = handle(async (req) => {
  await enforceRateLimit("signUp", clientIp(req));
  const input = await parseJson(req, signUpSchema);
  return created(await signUp(input));
});
