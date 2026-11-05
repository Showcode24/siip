import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseJson } from "@/server/lib/http";
import { confirmLogo } from "@/server/services/company.service";
import { logoSchema } from "@/server/validators/company";
import { enforceRateLimit } from "@/server/lib/rate-limit";

export const POST = handle(async (req) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  await enforceRateLimit("upload", ctx.user.id);
  return ok(await confirmLogo(ctx, (await parseJson(req, logoSchema)).publicId));
});
