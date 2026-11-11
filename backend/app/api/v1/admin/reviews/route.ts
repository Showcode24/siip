import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { pageMeta } from "@/server/lib/pagination";
import { listReviewQueue } from "@/server/services/profile-review.service";
import { reviewQueueQuery } from "@/server/validators/review";

/** Interns waiting for SIIP to check their skills (oldest first), or by review outcome. */
export const GET = handle(async (req) => {
  await requireAdmin(req);
  const page = await listReviewQueue(parseQuery(req, reviewQueueQuery));
  return ok(page.items, pageMeta(page));
});
