import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { listPlacementsForAdmin } from "@/server/services/placement.service";
import { placementListQuery } from "@/server/validators/matching";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const page = await listPlacementsForAdmin(parseQuery(req, placementListQuery));
  return ok(page.items, pageMeta(page));
});
