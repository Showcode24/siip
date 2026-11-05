import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseQuery } from "@/server/lib/http";
import { getSuggestions } from "@/server/services/match.service";
import { suggestionsQuery } from "@/server/validators/matching";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const q = parseQuery(req, suggestionsQuery);
  return ok(await getSuggestions(q.openingId, q.limit));
});
