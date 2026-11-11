import { requireGraduate } from "@/server/auth/session";
import { handle, ok } from "@/server/lib/http";
import { getMySiipTest } from "@/server/services/siip-test.service";

/** The intern's SIIP test: whether it's open (and why not), the videos, and past attempts. */
export const GET = handle(async (req) => {
  const { graduateId } = await requireGraduate(req);
  return ok(await getMySiipTest(graduateId));
});
