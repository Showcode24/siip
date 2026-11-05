import { handle, ok, parseJson } from "@/server/lib/http";
import { requestPasswordReset } from "@/server/services/auth.service";
import { forgotPasswordSchema } from "@/server/validators/auth";
import { clientIp, enforceRateLimit } from "@/server/lib/rate-limit";

export const POST = handle(async (req) => {
  await enforceRateLimit("passwordReset", clientIp(req));
  const { email } = await parseJson(req, forgotPasswordSchema);
  await requestPasswordReset(email);
  return ok({ message: "If that email is registered, we have sent a reset link." });
});
