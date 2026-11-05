import { requireCompanyMember } from "@/server/auth/session";
import { created, handle, parseJson, parseWith } from "@/server/lib/http";
import { submitEvaluation } from "@/server/services/internship.service";
import { idParam } from "@/server/validators/common";
import { evaluationSchema } from "@/server/validators/internship";

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const ctx = await requireCompanyMember(req);
  const { id } = parseWith(idParam, await params);
  return created(await submitEvaluation(ctx, id, await parseJson(req, evaluationSchema)));
});
