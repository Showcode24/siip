import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { listOpeningsForAdmin } from "@/server/services/opening.service";
import { adminOpeningListQuery } from "@/server/validators/company";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const page = await listOpeningsForAdmin(parseQuery(req, adminOpeningListQuery));
  return ok(page.items, pageMeta(page));
});
