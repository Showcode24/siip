import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { deleteVideo, updateVideo } from "@/server/services/siip-test.service";
import { idParam } from "@/server/validators/common";
import { updateTestVideoSchema } from "@/server/validators/assessment";

export const PATCH = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await updateVideo(toAuditActor(admin), id, await parseJson(req, updateTestVideoSchema)));
});

export const DELETE = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await deleteVideo(toAuditActor(admin), id));
});
