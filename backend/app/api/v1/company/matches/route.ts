import { requireCompanyMember } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { listCompanyMatches } from "@/server/services/match.service";
import { matchListQuery } from "@/server/validators/matching";

export const GET = handle(async (req) => {
  const ctx = await requireCompanyMember(req);
  const page = await listCompanyMatches(ctx, parseQuery(req, matchListQuery));
  return ok(page.items, pageMeta(page));
});
