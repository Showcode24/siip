import { handle, ok, withAuthCookies } from "@/server/lib/http";
import { signOut } from "@/server/services/auth.service";

export const POST = handle(async (req) => {
  const { headers } = await signOut(req.headers);
  return withAuthCookies(ok({ signedOut: true }), headers);
});
