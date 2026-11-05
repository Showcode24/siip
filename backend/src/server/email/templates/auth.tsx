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
