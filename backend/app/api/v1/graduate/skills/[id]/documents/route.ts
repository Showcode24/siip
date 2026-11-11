import { requireGraduate } from "@/server/auth/session";
import { created, handle, parseJson, parseWith } from "@/server/lib/http";
import { addSkillFile, addSkillLink } from "@/server/services/skill.service";
import { idParam } from "@/server/validators/common";
import { skillDocumentSchema } from "@/server/validators/graduate";

/** Attach proof: a file uploaded in step 1 (checked here), or a link. */
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const { graduateId } = await requireGraduate(req);
  const { id } = parseWith(idParam, await params);
  const doc = await parseJson(req, skillDocumentSchema);
  return created(
    doc.kind === "FILE"
      ? await addSkillFile(graduateId, id, { publicId: doc.publicId, fileName: doc.fileName })
      : await addSkillLink(graduateId, id, doc.url),
  );
});
