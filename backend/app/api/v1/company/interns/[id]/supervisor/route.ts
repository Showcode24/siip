import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { assignSupervisor } from "@/server/services/placement.service";
import { idParam } from "@/server/validators/common";
import { assignSupervisorSchema } from "@/server/validators/matching";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  const { id } = parseWith(idParam, await params);
  const body = await parseJson(req, assignSupervisorSchema);
  return ok(await assignSupervisor(ctx, id, body.supervisorId));
});
