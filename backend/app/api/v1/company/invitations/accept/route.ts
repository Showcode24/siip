import { requireUser } from "@/server/auth/session";
import { handle, ok, parseJson } from "@/server/lib/http";
import { acceptInvitation } from "@/server/services/company.service";
import { acceptInviteSchema } from "@/server/validators/company";

export const POST = handle(async (req) => {
  const user = await requireUser(req, { roles: ["COMPANY_MEMBER"] });
  return ok(await acceptInvitation(user, (await parseJson(req, acceptInviteSchema)).token));
});
