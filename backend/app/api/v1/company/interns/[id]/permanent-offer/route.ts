import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { recordPermanentOffer } from "@/server/services/internship.service";
import { idParam } from "@/server/validators/common";
import { permanentOfferSchema } from "@/server/validators/internship";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  const { id } = parseWith(idParam, await params);
  return ok(await recordPermanentOffer(ctx, id, await parseJson(req, permanentOfferSchema)));
});
