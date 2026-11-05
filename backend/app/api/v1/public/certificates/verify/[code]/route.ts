import { handle, ok, parseWith } from "@/server/lib/http";
import { verifyCertificate } from "@/server/services/certificate.service";
import { verificationCodeParam } from "@/server/validators/internship";
import { clientIp, enforceRateLimit } from "@/server/lib/rate-limit";

// Public: lets an employer confirm a certificate is genuine.
export const GET = handle<{ code: string }>(async (req, { params }) => {
  await enforceRateLimit("certificateVerify", clientIp(req));
  const { code } = parseWith(verificationCodeParam, await params);
  return ok(await verifyCertificate(code));
});
