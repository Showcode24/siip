import { CTA, Layout, P, Small } from "./layout";

export interface ApplicationEmailProps {
  firstName: string;
  cohortName: string;
  dashboardUrl: string;
}

export function ApplicationReceivedEmail({ firstName, cohortName, dashboardUrl }: ApplicationEmailProps) {
  return (
    <Layout preview={`We received your application to ${cohortName}`} heading="Application received">
      <P>
        Hi {firstName}, thank you for applying to <strong>{cohortName}</strong>. Our team will review your
        profile and CV, and we will email you when your application moves to the next stage.
      </P>
      <CTA href={dashboardUrl}>Track my application</CTA>
      <Small>
        Keep your profile up to date. A complete profile helps us match you with the right company.
      </Small>
    </Layout>
  );
}

export function ShortlistedEmail({ firstName, cohortName, dashboardUrl }: ApplicationEmailProps) {
  return (
    <Layout preview="Congratulations, you have been shortlisted" heading="You have been shortlisted">
      <P>
        Congratulations {firstName}! You have been shortlisted for <strong>{cohortName}</strong>. The next
        step is the training programme. We will let you know as soon as your courses are available.
      </P>
      <CTA href={dashboardUrl}>View my application</CTA>
    </Layout>
  );
}

export interface RejectedEmailProps extends ApplicationEmailProps {
  reason?: string;
}

export function ApplicationRejectedEmail({
  firstName,
  cohortName,
  dashboardUrl,
  reason,
}: RejectedEmailProps) {
  return (
    <Layout preview={`An update on your ${cohortName} application`} heading="An update on your application">
      <P>
        Hi {firstName}, thank you for your interest in <strong>{cohortName}</strong> and for the time you put
        into your application. After careful review, we are not able to offer you a place in this cohort.
      </P>
      {reason ? <P>{reason}</P> : null}
      <P>
        This is not the end of the road. We run new cohorts regularly, and we would be glad to see your
        application again. Keep building your skills and keep your profile up to date.
      </P>
      <CTA href={dashboardUrl}>See upcoming cohorts</CTA>
      <Small>We wish you every success.</Small>
    </Layout>
  );
}

export function TrainingStartedEmail({ firstName, cohortName, dashboardUrl }: ApplicationEmailProps) {
  return (
    <Layout preview="Your SIIP training has started" heading="Your training has started">
      <P>
        Hi {firstName}, training for <strong>{cohortName}</strong> is now open. Work through your lessons at
        your own pace and complete every module before the final assessment.
      </P>
      <CTA href={dashboardUrl}>Start learning</CTA>
    </Layout>
  );
}

export function QualifiedEmail({ firstName, cohortName, dashboardUrl }: ApplicationEmailProps) {
  return (
    <Layout preview="You have qualified for placement" heading="You have qualified">
      <P>
        Well done, {firstName}! You have completed training for <strong>{cohortName}</strong> and qualified
        for placement. We are now matching you with partner companies, and we will email you when a company
        accepts your match.
      </P>
      <CTA href={dashboardUrl}>View my progress</CTA>
    </Layout>
  );
}
