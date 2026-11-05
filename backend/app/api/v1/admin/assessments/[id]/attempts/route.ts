import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseQuery, parseWith } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { listAttempts } from "@/server/services/assessment.service";
import { attemptListQuery } from "@/server/validators/assessment";
import { idParam } from "@/server/validators/common";

export const GET = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  const page = await listAttempts(id, parseQuery(req, attemptListQuery));
  return ok(page.items, pageMeta(page));
});
