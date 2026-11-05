import { handle, ok, parseJson } from "@/server/lib/http";
import { resendVerification } from "@/server/services/auth.service";
import { resendVerificationSchema } from "@/server/validators/auth";
import { clientIp, enforceRateLimit } from "@/server/lib/rate-limit";

export const POST = handle(async (req) => {
  await enforceRateLimit("verificationEmail", clientIp(req));
  const { email } = await parseJson(req, resendVerificationSchema);
  await resendVerification(email);
  return ok({ message: "If that account exists and is unverified, we have sent a new link." });
});
