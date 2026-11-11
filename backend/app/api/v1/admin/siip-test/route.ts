import { requireAdmin } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { getSiipTestForAdmin } from "@/server/services/siip-test.service";

/** The SIIP test as admins manage it: settings, videos, questions and attempt numbers. */
export const GET = handle(async (req) => {
  await requireAdmin(req);
  return ok(await getSiipTestForAdmin());
});
