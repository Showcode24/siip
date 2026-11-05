import { requireAdmin } from "@/server/auth/session";
import { handle, ok, parseJson, parseWith } from "@/server/lib/http";
import { signLessonAttachment } from "@/server/services/training.service";
import { signAttachmentSchema } from "@/server/validators/training";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  return ok(await signLessonAttachment(id, (await parseJson(req, signAttachmentSchema)).extension));
});
