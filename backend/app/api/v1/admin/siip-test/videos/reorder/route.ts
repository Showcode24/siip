import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson } from "@/server/lib/http";
import { reorderVideos } from "@/server/services/siip-test.service";
import { reorderVideosSchema } from "@/server/validators/assessment";

/** Puts the videos in a new order (every video id, once). */
export const POST = handle(async (req) => {
  const admin = await requireAdmin(req);
  const { ids } = await parseJson(req, reorderVideosSchema);
  return ok(await reorderVideos(toAuditActor(admin), ids));
});
