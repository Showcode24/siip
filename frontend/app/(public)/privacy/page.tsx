import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How SIIP collects, uses and protects your personal data under the Nigeria Data Protection Act 2023.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      updated="1 November 2026"
      sections={[
        {
          id: "who",
          heading: "Who we are",
          body: (
            <p>
              SIIP is a graduate internship programme run by SkillzBridge Trades Africa. We are the data
              controller for the personal data you give us on this website.
            </p>
          ),
        },
        {
          id: "what",
          heading: "What we collect",
          body: (
            <>
              <p>
                Your name, email, phone number, state and LGA, education, NYSC status, skills, CV, assessment
                results, training progress and internship records.
              </p>
              <p>
                For company users: your name, work email, job title and your company&apos;s registration
                details.
              </p>
            </>
          ),
        },
        {
          id: "why",
          heading: "Why we use it",
          body: (
            <p>
              To run the programme: screening, training, assessments, matching you to companies, monitoring
              internships and issuing certificates. We rely on your consent, given when you register, and on
              our legitimate interest in running a fair programme.
            </p>
          ),
        },
        {
          id: "sharing",
          heading: "Who we share it with",
          body: (
            <p>
              Partner companies see a limited profile (no phone, email or CV) until they accept a match. After
              that they see your contact details and CV. We use trusted processors for email (Resend), file
              storage (Cloudinary) and hosting.
            </p>
          ),
        },
        {
          id: "rights",
          heading: "Your rights",
          body: (
            <p>
              You can download all your data and delete your account at any time from Settings. Deleted
              accounts are anonymised after 30 days. You can also contact us to correct your data or object to
              how we use it.
            </p>
          ),
        },
        {
          id: "retention",
          heading: "How long we keep it",
          body: (
            <p>
              We keep programme records while your account is active and for as long as the law requires
              afterwards. Certificates stay verifiable unless you ask us to remove them.
            </p>
          ),
        },
        { id: "contact", heading: "Contact", body: <p>Questions about your data? Email privacy@siip.ng.</p> },
      ]}
    />
  );
}
