import { CTA, Layout, P, Small } from "./layout";

export interface AssessmentResultProps {
  firstName: string;
  assessmentTitle: string;
  percentage: number;
  passed: boolean;
  dashboardUrl: string;
}

export function AssessmentResultEmail({
  firstName,
  assessmentTitle,
  percentage,
  passed,
  dashboardUrl,
}: AssessmentResultProps) {
  return (
    <Layout
      preview={`Your ${assessmentTitle} result`}
      heading={passed ? "You passed" : "Your assessment result"}
    >
      <P>
        Hi {firstName}, you scored <strong>{percentage}%</strong> on <strong>{assessmentTitle}</strong>.
      </P>
      <P>
        {passed
          ? "Congratulations, you passed. We will let you know about your next step shortly."
          : "You did not reach the pass mark this time. Check your dashboard to see whether you have another attempt."}
      </P>
      <CTA href={dashboardUrl}>View my assessments</CTA>
      <Small>Results are scored automatically and cannot be changed by replying to this email.</Small>
    </Layout>
  );
}
