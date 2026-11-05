import { requireCompanyMember } from "@/server/auth/session";
import { created, handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { listInternCheckIns, submitSupervisorCheckIn } from "@/server/services/internship.service";
import { idParam } from "@/server/validators/common";
import { checkInSchema } from "@/server/validators/internship";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req);
  const { id } = parseWith(idParam, await params);
  return ok(await listInternCheckIns(ctx, id));
});

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req);
  const { id } = parseWith(idParam, await params);
  return created(await submitSupervisorCheckIn(ctx, id, await parseJson(req, checkInSchema)));
});
