import { CTA, Layout, P, Small } from "./layout";

export interface CompanyVerifiedProps {
  firstName: string;
  companyName: string;
  dashboardUrl: string;
}

export function CompanyVerifiedEmail({ firstName, companyName, dashboardUrl }: CompanyVerifiedProps) {
  return (
    <Layout preview={`${companyName} is now verified on SIIP`} heading="Your company is verified">
      <P>
        Hi {firstName}, good news: <strong>{companyName}</strong> has been verified as a SIIP partner. You can
        now publish internship openings, and we will start matching qualified graduates to them.
      </P>
      <CTA href={dashboardUrl}>Post an opening</CTA>
      <Small>Invite your supervisors from the company dashboard so they can follow their interns.</Small>
    </Layout>
  );
}

export interface SupervisorInvitationProps {
  companyName: string;
  inviterName: string;
  acceptUrl: string;
}

export function SupervisorInvitationEmail({
  companyName,
  inviterName,
  acceptUrl,
}: SupervisorInvitationProps) {
  return (
    <Layout preview={`Join ${companyName} on SIIP`} heading={`Join ${companyName} on SIIP`}>
      <P>
        {inviterName} has invited you to join <strong>{companyName}</strong> on SIIP as an internship
        supervisor. Supervisors follow the progress of their interns, submit monthly check-ins and complete
        the final evaluation.
      </P>
      <CTA href={acceptUrl}>Accept invitation</CTA>
      <Small>
        Create a company account with this email address (or sign in), then accept. The link expires in 7
        days. If you were not expecting this, you can ignore this email.
      </Small>
    </Layout>
  );
}
