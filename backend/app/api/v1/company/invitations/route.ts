import { requireCompanyMember } from "@/server/auth/session";
import { created, handle, ok, parseJson } from "@/server/lib/http";
import { inviteSupervisor, listInvitations } from "@/server/services/company.service";
import { inviteSchema } from "@/server/validators/company";

export const GET = handle(async (req) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  return ok(await listInvitations(ctx));
});

export const POST = handle(async (req) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  return created(await inviteSupervisor(ctx, (await parseJson(req, inviteSchema)).email));
});
