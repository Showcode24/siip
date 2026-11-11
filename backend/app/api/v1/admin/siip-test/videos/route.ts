import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { created, handle, parseJson } from "@/server/lib/http";
import { createVideo } from "@/server/services/siip-test.service";
import { testVideoSchema } from "@/server/validators/assessment";

/** Adds a video (title and a YouTube link; leave the link empty for a placeholder). */
export const POST = handle(async (req) => {
  const admin = await requireAdmin(req);
  return created(await createVideo(toAuditActor(admin), await parseJson(req, testVideoSchema)));
});
