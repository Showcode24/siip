import { render } from "@react-email/components";
import { Resend } from "resend";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { describeError, logger } from "@/server/lib/logger";
import { templates, type TemplateName, type TemplateProps } from "./templates";

let resendClient: Resend | null | undefined;

function getResend(): Resend | null {
  if (resendClient === undefined) {
    const key = env().RESEND_API_KEY;
    resendClient = key ? new Resend(key) : null;
  }
  return resendClient;
}

export interface SendEmailInput<N extends TemplateName> {
  template: N;
  props: TemplateProps<N>;
  to: string;
  toUserId?: string;
  /**
   * One key per logical event, e.g. `application-received:${applicationId}`.
   * A key that was already sent (or is in flight) is skipped.
   */
  idempotencyKey: string;
}

export type SendEmailResult = "sent" | "skipped" | "failed" | "logged";

/**
 * Sends a templated email and records it in EmailLog.
 * Never throws: a failed email must not break the action that triggered it.
 */
export async function sendEmail<N extends TemplateName>(input: SendEmailInput<N>): Promise<SendEmailResult> {
  try {
    const claimed = await claimSend(input);
    if (!claimed) return "skipped";

    const template = templates[input.template] as {
      subject: (p: TemplateProps<N>) => string;
      render: (p: TemplateProps<N>) => React.ReactElement;
    };
    const element = template.render(input.props);
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);

    const resend = getResend();
    if (!resend) {
      // Dev/test without a Resend key: mark as sent so flows behave the same.
      await db.emailLog.update({
        where: { id: claimed.id },
        data: { status: "SENT", sentAt: new Date(), providerId: "log-only" },
      });
      logger.info("Email logged (no RESEND_API_KEY)", { template: input.template, emailLogId: claimed.id });
      return "logged";
    }

    const { data, error } = await resend.emails.send(
      { from: env().EMAIL_FROM, to: input.to, subject: claimed.subject, html, text },
      { idempotencyKey: input.idempotencyKey },
    );
    if (error) throw new Error(`Resend error: ${error.name}`);

    await db.emailLog.update({
      where: { id: claimed.id },
      data: { status: "SENT", sentAt: new Date(), providerId: data?.id ?? null, error: null },
    });
    return "sent";
  } catch (err) {
    logger.error("Email send failed", { template: input.template, ...describeError(err) });
    await db.emailLog
      .update({
        where: { idempotencyKey: input.idempotencyKey },
        data: { status: "FAILED", error: err instanceof Error ? err.message.slice(0, 500) : "unknown" },
      })
      .catch(() => undefined);
    return "failed";
  }
}

/**
 * Reserves the idempotency key. Returns the log row if this call should send,
 * or null if the email was already sent or is being sent by another request.
 * FAILED rows are reclaimed so a later retry can succeed.
 */
async function claimSend<N extends TemplateName>(input: SendEmailInput<N>) {
  const subject = (templates[input.template].subject as (p: TemplateProps<N>) => string)(input.props);
  const created = await db.emailLog.createMany({
    data: {
      idempotencyKey: input.idempotencyKey,
      template: input.template,
      toEmail: input.to,
      toUserId: input.toUserId ?? null,
      subject,
    },
    skipDuplicates: true,
  });
  if (created.count === 1) {
    return db.emailLog.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
  }
  const retried = await db.emailLog.updateMany({
    where: { idempotencyKey: input.idempotencyKey, status: "FAILED" },
    data: { status: "PENDING", error: null },
  });
  if (retried.count === 0) return null;
  return db.emailLog.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
}
