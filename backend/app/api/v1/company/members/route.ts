import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { listMembers } from "@/server/services/company.service";

export const GET = handle(async (req) => {
  const ctx = await requireCompanyMember(req);
  return ok(await listMembers(ctx));
});
