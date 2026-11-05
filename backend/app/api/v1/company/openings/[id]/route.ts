import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { getMyOpening, updateOpening } from "@/server/services/opening.service";
import { idParam } from "@/server/validators/common";
import { updateOpeningSchema } from "@/server/validators/company";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getMyOpening(ctx, id));
});

export const PATCH = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  const { id } = parseWith(idParam, await params);
  return ok(await updateOpening(ctx, id, await parseJson(req, updateOpeningSchema)));
});
