import { handle, ok, parseJson } from "@/server/lib/http";
import { clientIp, enforceRateLimit } from "@/server/lib/rate-limit";
import { sendContactMessage } from "@/server/services/contact.service";
import { contactSchema } from "@/server/validators/auth";

export const POST = handle(async (req) => {
  await enforceRateLimit("contact", clientIp(req));
  await sendContactMessage(await parseJson(req, contactSchema));
  return ok({ message: "Thanks. We'll reply within two working days." });
});
