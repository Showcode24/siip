import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { listCompaniesForAdmin } from "@/server/services/company.service";
import { adminCompanyListQuery } from "@/server/validators/company";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const page = await listCompaniesForAdmin(parseQuery(req, adminCompanyListQuery));
  return ok(page.items, pageMeta(page));
});
