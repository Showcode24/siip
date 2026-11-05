import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { listMyInterns } from "@/server/services/placement.service";
import { placementListQuery } from "@/server/validators/matching";

export const GET = handle(async (req) => {
  const ctx = await requireCompanyMember(req);
  const page = await listMyInterns(ctx, parseQuery(req, placementListQuery));
  return ok(page.items, pageMeta(page));
});
