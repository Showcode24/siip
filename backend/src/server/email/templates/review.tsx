import { CTA, Layout, P, Small } from "./layout";

export interface ProfileApprovedProps {
  firstName: string;
  verifiedSkills: string[];
  profileUrl: string;
}

export function ProfileApprovedEmail({ firstName, verifiedSkills, profileUrl }: ProfileApprovedProps) {
  return (
    <Layout preview="Your SIIP profile is approved" heading="Your profile is approved">
      <P>
        Hi {firstName}, we checked your documents and approved your profile. You&apos;re now on the list of
        interns we match with companies.
      </P>
      {verifiedSkills.length ? (
        <P>
          Verified skills: <strong>{verifiedSkills.join(", ")}</strong>.
        </P>
      ) : null}
      <CTA href={profileUrl}>See your skills</CTA>
      <Small>Companies see your verified skills and levels. Keep your documents up to date.</Small>
    </Layout>
  );
}

export interface ChangesRequestedProps {
  firstName: string;
  note: string;
  profileUrl: string;
}

export function ChangesRequestedEmail({ firstName, note, profileUrl }: ChangesRequestedProps) {
  return (
    <Layout preview="SIIP needs more documents from you" heading="We need more documents">
      <P>Hi {firstName}, we reviewed your profile and need a little more from you before we can approve it.</P>
      <P>
        <strong>Our note:</strong> {note}
      </P>
      <CTA href={profileUrl}>Add documents</CTA>
      <Small>When you&apos;ve added them, send your profile for review again from the same page.</Small>
    </Layout>
  );
}

export interface ProfileRemovedProps {
  firstName: string;
  reason: string;
  deleteAfterDays: number;
  /** Null when no support address is configured. */
  supportEmail: string | null;
}

export function ProfileRemovedEmail({ firstName, reason, deleteAfterDays, supportEmail }: ProfileRemovedProps) {
  return (
    <Layout preview="Your SIIP profile has been removed" heading="Your profile has been removed">
      <P>
        Hi {firstName}, we&apos;ve removed your SIIP profile because the documents you provided didn&apos;t
        support the skills you listed.
      </P>
      <P>
        <strong>Reason:</strong> {reason}
      </P>
      <P>
        Your account is locked. If you think this is a mistake,{" "}
        {supportEmail ? `contact us at ${supportEmail}` : "contact the SIIP team through our website"} within{" "}
        {deleteAfterDays} days and we can reopen it. After that, your profile and documents are deleted
        permanently.
      </P>
      <Small>You&apos;re welcome to register again once you have certificates that support your skills.</Small>
    </Layout>
  );
}
