import { CTA, Layout, P, Small } from "./layout";

export interface MatchProposedProps {
  firstName: string;
  companyName: string;
  openingTitle: string;
  reviewUrl: string;
}

export function MatchProposedEmail({ firstName, companyName, openingTitle, reviewUrl }: MatchProposedProps) {
  return (
    <Layout
      preview={`A SIIP graduate has been matched to ${openingTitle}`}
      heading="New candidate for review"
    >
      <P>
        Hi {firstName}, we have matched a qualified SIIP graduate to your opening{" "}
        <strong>{openingTitle}</strong> at {companyName}. Please review their profile and accept or decline
        within 3 days.
      </P>
      <CTA href={reviewUrl}>Review candidate</CTA>
      <Small>Contact details are shared once you accept the match.</Small>
    </Layout>
  );
}

export interface MatchAcceptedProps {
  firstName: string;
  companyName: string;
  openingTitle: string;
  companyAddress: string;
  workMode: string;
  startDate: string;
  endDate: string;
  dashboardUrl: string;
}

export function MatchAcceptedEmail(p: MatchAcceptedProps) {
  return (
    <Layout preview={`${p.companyName} has accepted you`} heading="You have been placed">
      <P>
        Congratulations {p.firstName}! <strong>{p.companyName}</strong> has accepted you for the{" "}
        <strong>{p.openingTitle}</strong> internship.
      </P>
      <P>
        Address: {p.companyAddress}
        <br />
        Work mode: {p.workMode}
        <br />
        Dates: {p.startDate} to {p.endDate}
      </P>
      <CTA href={p.dashboardUrl}>View placement details</CTA>
      <Small>Your supervisor will contact you before your start date.</Small>
    </Layout>
  );
}

export interface PlacementStartedProps {
  firstName: string;
  internName: string;
  internEmail: string;
  internPhone: string;
  openingTitle: string;
  startDate: string;
  endDate: string;
  dashboardUrl: string;
}

export function PlacementStartedEmail(p: PlacementStartedProps) {
  return (
    <Layout preview={`${p.internName} is joining you as an intern`} heading="Your new intern">
      <P>
        Hi {p.firstName}, <strong>{p.internName}</strong> will join you as <strong>{p.openingTitle}</strong>{" "}
        from {p.startDate} to {p.endDate}.
      </P>
      <P>
        Email: {p.internEmail}
        <br />
        Phone: {p.internPhone}
      </P>
      <CTA href={p.dashboardUrl}>View intern</CTA>
      <Small>Please submit a short check-in every month and the final evaluation at the end.</Small>
    </Layout>
  );
}
