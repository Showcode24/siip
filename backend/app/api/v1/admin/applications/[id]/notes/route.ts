import { requireAdmin, toAuditActor } from "@/server/auth/session";
import { created, handle, parseJson, parseWith } from "@/server/lib/http";
import { addApplicationNote } from "@/server/services/application.service";
import { addNoteSchema } from "@/server/validators/application";
import { idParam } from "@/server/validators/common";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const { id } = parseWith(idParam, await params);
  const { body } = await parseJson(req, addNoteSchema);
  return created(await addApplicationNote(toAuditActor(admin), id, body));
});
