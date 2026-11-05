import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using SIIP as a graduate or a partner company.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="1 November 2026"
      sections={[
        {
          id: "free",
          heading: "SIIP is free",
          body: (
            <p>
              Graduates never pay to register, train, take assessments, be placed or receive a certificate.
              Report anyone who asks you for money in SIIP&apos;s name.
            </p>
          ),
        },
        {
          id: "accounts",
          heading: "Your account",
          body: <p>Give accurate information and keep your password safe. One account per person.</p>,
        },
        {
          id: "assessments",
          heading: "Fair assessments",
          body: (
            <p>
              Assessments must be your own work. Attempts are timed and scored on our servers. Cheating can
              lead to removal from the programme.
            </p>
          ),
        },
        {
          id: "companies",
          heading: "Partner companies",
          body: (
            <p>
              Companies must be registered with the CAC, provide a safe workplace, supervise interns and
              submit monthly check-ins and a final evaluation.
            </p>
          ),
        },
        {
          id: "certificates",
          heading: "Certificates",
          body: (
            <p>
              Certificates are issued only after a completed internship, a company evaluation and SIIP&apos;s
              approval. Anyone can verify one with its code.
            </p>
          ),
        },
        {
          id: "changes",
          heading: "Changes",
          body: <p>We may update these terms. We&apos;ll tell you about important changes by email.</p>,
        },
      ]}
    />
  );
}
