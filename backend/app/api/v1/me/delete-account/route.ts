import { requireUser } from "@/server/auth/session";
import { handle, ok, parseJson } from "@/server/lib/http";
import { requestAccountDeletion } from "@/server/services/privacy.service";
import { deleteAccountSchema } from "@/server/validators/admin";

// NDPA right to erasure: soft delete now, anonymise after the grace period.
export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const { password } = await parseJson(req, deleteAccountSchema);
  const res = ok(await requestAccountDeletion(user, password));
  res.cookies.delete("better-auth.session_token");
  res.cookies.delete("__Secure-better-auth.session_token");
  return res;
});
