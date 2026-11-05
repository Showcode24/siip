import { requireUser } from "@/server/auth/session";
import { created, handle, parseJson } from "@/server/lib/http";
import { registerCompany } from "@/server/services/company.service";
import { registerCompanySchema } from "@/server/validators/company";

export const POST = handle(async (req) => {
  const user = await requireUser(req, { roles: ["COMPANY_MEMBER"] });
  return created(await registerCompany(user, await parseJson(req, registerCompanySchema)));
});
