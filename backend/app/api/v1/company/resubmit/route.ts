import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { resubmitCompany } from "@/server/services/company.service";

export const POST = handle(async (req) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  return ok(await resubmitCompany(ctx));
});
