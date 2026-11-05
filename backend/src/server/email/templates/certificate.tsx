import { CTA, Layout, P, Small } from "./layout";

export interface CertificateIssuedProps {
  firstName: string;
  cohortName: string;
  downloadUrl: string;
  verifyUrl: string;
  verificationCode: string;
}

export function CertificateIssuedEmail(p: CertificateIssuedProps) {
  return (
    <Layout preview="Your SIIP certificate is ready" heading="Your certificate is ready">
      <P>
        Congratulations {p.firstName}! You have completed <strong>{p.cohortName}</strong>, and your SIIP
        certificate has been issued.
      </P>
      <CTA href={p.downloadUrl}>Download my certificate</CTA>
      <P>
        Employers can confirm your certificate is genuine at {p.verifyUrl} using the code{" "}
        <strong>{p.verificationCode}</strong>.
      </P>
      <Small>Keep this email: the verification code proves your certificate is real.</Small>
    </Layout>
  );
}
