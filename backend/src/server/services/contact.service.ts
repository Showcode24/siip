import { randomUUID } from "node:crypto";
import { sendEmail } from "@/server/email/send";
import { env } from "@/server/env";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import type { ContactInput } from "@/server/validators/auth";

/** Forwards a contact-form message to SUPPORT_EMAIL, with reply-to set to the sender. */
export async function sendContactMessage(input: ContactInput) {
  const to = env().SUPPORT_EMAIL;
  if (!to) {
    logger.error("Contact form used but SUPPORT_EMAIL is not set");
    throw new AppError("INTERNAL_ERROR", "We couldn't send your message. Please email us directly.");
  }
  const result = await sendEmail({
    template: "contact-message",
    props: input,
    to,
    replyTo: input.email,
    idempotencyKey: `contact:${randomUUID()}`,
  });
  if (result === "failed") {
    throw new AppError("INTERNAL_ERROR", "We couldn't send your message. Please try again.");
  }
}
