import { handle, ok, parseJson } from "@/server/lib/http";
import { resetPassword } from "@/server/services/auth.service";
import { resetPasswordSchema } from "@/server/validators/auth";
import { clientIp, enforceRateLimit } from "@/server/lib/rate-limit";

export const POST = handle(async (req) => {
  await enforceRateLimit("passwordReset", clientIp(req));
  const { token, newPassword } = await parseJson(req, resetPasswordSchema);
  await resetPassword(token, newPassword);
  return ok({ message: "Your password has been reset. Please sign in." });
});
