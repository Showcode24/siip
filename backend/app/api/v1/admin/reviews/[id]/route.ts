import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { getReview } from "@/server/services/profile-review.service";
import { idParam } from "@/server/validators/common";

/** One intern's profile, skills with documents, and review history. */
export const GET = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await getReview(id));
});
