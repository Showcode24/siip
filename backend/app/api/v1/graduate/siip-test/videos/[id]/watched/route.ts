import { requireGraduate } from "@/server/auth/session";
import { handle, ok, parseWith } from "@/server/lib/http";
import { markVideoWatched } from "@/server/services/siip-test.service";
import { idParam } from "@/server/validators/common";

/** Marks a SIIP test video as watched. The quiz opens once every video is. */
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const { graduateId } = await requireGraduate(req);
  const { id } = parseWith(idParam, await params);
  return ok(await markVideoWatched(graduateId, id));
});
