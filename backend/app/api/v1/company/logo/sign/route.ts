import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { signLogoUpload } from "@/server/services/company.service";
import { enforceRateLimit } from "@/server/lib/rate-limit";

export const POST = handle(async (req) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  await enforceRateLimit("upload", ctx.user.id);
  return ok(await signLogoUpload(ctx));
});
