import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseJson } from "@/server/lib/http";
import { getMyCompany, updateMyCompany } from "@/server/services/company.service";
import { updateCompanySchema } from "@/server/validators/company";

export const GET = handle(async (req) => {
  const ctx = await requireCompanyMember(req);
  return ok(await getMyCompany(ctx));
});

export const PATCH = handle(async (req) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  return ok(await updateMyCompany(ctx, await parseJson(req, updateCompanySchema)));
});
