import { CTA, Layout, P, Small } from "./layout";

export interface VerifyEmailProps {
  firstName: string;
  verifyUrl: string;
}

export function WelcomeVerifyEmail({ firstName, verifyUrl }: VerifyEmailProps) {
  return (
    <Layout preview="Confirm your email to get started with SIIP" heading={`Welcome to SIIP, ${firstName}`}>
      <P>
        Thank you for signing up. Please confirm your email address so we can keep you updated about your
        application and programme activities.
      </P>
      <CTA href={verifyUrl}>Verify my email</CTA>
      <Small>
        This link expires in 24 hours. If you did not create a SIIP account, you can ignore this email.
      </Small>
    </Layout>
  );
}

const TOPIC: Record<ContactMessageProps["topic"], string> = {
  graduate: "Interns and skills",
  company: "Companies",
  certificate: "Certificates",
  other: "Something else",
};

export interface ContactMessageProps {
  name: string;
  email: string;
  topic: "graduate" | "company" | "certificate" | "other";
  message: string;
}

/** Sent to SUPPORT_EMAIL; replying goes straight to the sender. */
export function ContactMessageEmail({ name, email, topic, message }: ContactMessageProps) {
  return (
    <Layout preview={`New message from ${name}`} heading="New message from the website">
      <P>
        From {name} ({email}), about: {TOPIC[topic]}.
      </P>
      <P>{message}</P>
      <Small>Reply to this email to answer them directly.</Small>
    </Layout>
  );
}

export interface PasswordResetProps {
  firstName: string;
  resetUrl: string;
}

export function PasswordResetEmail({ firstName, resetUrl }: PasswordResetProps) {
  return (
    <Layout preview="Reset your SIIP password" heading="Reset your password">
      <P>Hi {firstName}, we received a request to reset the password on your SIIP account.</P>
      <CTA href={resetUrl}>Choose a new password</CTA>
      <Small>
        This link expires in 1 hour. If you did not ask for this, you can ignore this email; your password
        will not change.
      </Small>
    </Layout>
  );
}
