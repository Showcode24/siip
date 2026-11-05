import { CTA, Layout, P, Small } from "./layout";

export interface ProgressReminderProps {
  firstName: string;
  /** e.g. "3 lessons left" or "your final assessment" */
  pending: string;
  dashboardUrl: string;
}

export function ProgressReminderEmail({ firstName, pending, dashboardUrl }: ProgressReminderProps) {
  return (
    <Layout preview="Keep going with your SIIP training" heading="Keep going">
      <P>
        Hi {firstName}, you still have <strong>{pending}</strong> to complete. Finishing on time keeps you on
        track for placement with a partner company.
      </P>
      <CTA href={dashboardUrl}>Continue</CTA>
    </Layout>
  );
}

export interface MatchReminderProps {
  firstName: string;
  pendingCount: number;
  reviewUrl: string;
}

export function MatchReminderEmail({ firstName, pendingCount, reviewUrl }: MatchReminderProps) {
  return (
    <Layout preview="Candidates are waiting for your decision" heading="Candidates waiting for review">
      <P>
        Hi {firstName}, {pendingCount === 1 ? "a SIIP graduate is" : `${pendingCount} SIIP graduates are`}{" "}
        waiting for your decision for more than 3 days. Please accept or decline so they can move on.
      </P>
      <CTA href={reviewUrl}>Review candidates</CTA>
    </Layout>
  );
}

export interface CheckInReminderProps {
  firstName: string;
  month: number;
  internName: string;
  checkInUrl: string;
}

export function CheckInReminderEmail({ firstName, month, internName, checkInUrl }: CheckInReminderProps) {
  return (
    <Layout preview={`Month ${month} check-in is due`} heading={`Month ${month} check-in is due`}>
      <P>
        Hi {firstName}, the month {month} check-in for {internName}&apos;s internship has not been submitted
        yet. It only takes a few minutes and helps SIIP support the internship.
      </P>
      <CTA href={checkInUrl}>Submit check-in</CTA>
    </Layout>
  );
}

export interface EvaluationRequestProps {
  firstName: string;
  internName: string;
  endDate: string;
  evaluationUrl: string;
}

export function EvaluationRequestEmail({
  firstName,
  internName,
  endDate,
  evaluationUrl,
}: EvaluationRequestProps) {
  return (
    <Layout preview={`Please evaluate ${internName}`} heading="Final evaluation requested">
      <P>
        Hi {firstName}, {internName}&apos;s internship ends on {endDate}. Please submit the final evaluation.
        It is required before SIIP can issue the intern&apos;s certificate.
      </P>
      <CTA href={evaluationUrl}>Evaluate intern</CTA>
      <Small>The evaluation covers punctuality, skill, communication, teamwork and initiative.</Small>
    </Layout>
  );
}
