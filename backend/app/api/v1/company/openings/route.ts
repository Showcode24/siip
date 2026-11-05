import { requireCompanyMember } from "@/server/auth/session";
import { created, handle, ok, parseJson, parseQuery } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { createOpening, listMyOpenings } from "@/server/services/opening.service";
import { createOpeningSchema, openingListQuery } from "@/server/validators/company";

export const GET = handle(async (req) => {
  const ctx = await requireCompanyMember(req);
  const page = await listMyOpenings(ctx, parseQuery(req, openingListQuery));
  return ok(page.items, pageMeta(page));
});

export const POST = handle(async (req) => {
  const ctx = await requireCompanyMember(req, { ownerOnly: true });
  return created(await createOpening(ctx, await parseJson(req, createOpeningSchema)));
});
