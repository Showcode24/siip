import type { ReactElement } from "react";
import {
  ApplicationReceivedEmail,
  ApplicationRejectedEmail,
  QualifiedEmail,
  ShortlistedEmail,
  TrainingStartedEmail,
  type ApplicationEmailProps,
  type RejectedEmailProps,
} from "./application";
import { AssessmentResultEmail, type AssessmentResultProps } from "./assessment";
import {
  CompanyVerifiedEmail,
  SupervisorInvitationEmail,
  type CompanyVerifiedProps,
  type SupervisorInvitationProps,
} from "./company";
import {
  MatchAcceptedEmail,
  MatchProposedEmail,
  PlacementStartedEmail,
  type MatchAcceptedProps,
  type MatchProposedProps,
  type PlacementStartedProps,
} from "./matching";
import { CertificateIssuedEmail, type CertificateIssuedProps } from "./certificate";
import {
  ChangesRequestedEmail,
  ProfileApprovedEmail,
  ProfileRemovedEmail,
  type ChangesRequestedProps,
  type ProfileApprovedProps,
  type ProfileRemovedProps,
} from "./review";
import {
  CheckInReminderEmail,
  EvaluationRequestEmail,
  MatchReminderEmail,
  ProgressReminderEmail,
  type CheckInReminderProps,
  type EvaluationRequestProps,
  type MatchReminderProps,
  type ProgressReminderProps,
} from "./reminders";
import {
  PasswordResetEmail,
  WelcomeVerifyEmail,
  type PasswordResetProps,
  type VerifyEmailProps,
} from "./auth";

interface TemplateDef<P> {
  subject: (props: P) => string;
  render: (props: P) => ReactElement;
}

function define<P>(def: TemplateDef<P>): TemplateDef<P> {
  return def;
}

// Each later phase registers its templates here.
export const templates = {
  "welcome-verify": define<VerifyEmailProps>({
    subject: () => "Welcome to SIIP: please verify your email",
    render: (p) => WelcomeVerifyEmail(p),
  }),
  "password-reset": define<PasswordResetProps>({
    subject: () => "Reset your SIIP password",
    render: (p) => PasswordResetEmail(p),
  }),
  "application-received": define<ApplicationEmailProps>({
    subject: (p) => `We received your application to ${p.cohortName}`,
    render: (p) => ApplicationReceivedEmail(p),
  }),
  "application-shortlisted": define<ApplicationEmailProps>({
    subject: () => "You have been shortlisted for SIIP",
    render: (p) => ShortlistedEmail(p),
  }),
  "application-rejected": define<RejectedEmailProps>({
    subject: (p) => `An update on your ${p.cohortName} application`,
    render: (p) => ApplicationRejectedEmail(p),
  }),
  "training-started": define<ApplicationEmailProps>({
    subject: () => "Your SIIP training has started",
    render: (p) => TrainingStartedEmail(p),
  }),
  qualified: define<ApplicationEmailProps>({
    subject: () => "You have qualified for SIIP placement",
    render: (p) => QualifiedEmail(p),
  }),
  "assessment-result": define<AssessmentResultProps>({
    subject: (p) => `Your result: ${p.assessmentTitle}`,
    render: (p) => AssessmentResultEmail(p),
  }),
  "company-verified": define<CompanyVerifiedProps>({
    subject: (p) => `${p.companyName} is verified on SIIP`,
    render: (p) => CompanyVerifiedEmail(p),
  }),
  "supervisor-invitation": define<SupervisorInvitationProps>({
    subject: (p) => `You're invited to join ${p.companyName} on SIIP`,
    render: (p) => SupervisorInvitationEmail(p),
  }),
  "match-proposed": define<MatchProposedProps>({
    subject: (p) => `New SIIP candidate for ${p.openingTitle}`,
    render: (p) => MatchProposedEmail(p),
  }),
  "match-accepted": define<MatchAcceptedProps>({
    subject: (p) => `${p.companyName} has accepted you for an internship`,
    render: (p) => MatchAcceptedEmail(p),
  }),
  "placement-started": define<PlacementStartedProps>({
    subject: (p) => `Your new SIIP intern: ${p.internName}`,
    render: (p) => PlacementStartedEmail(p),
  }),
  "certificate-issued": define<CertificateIssuedProps>({
    subject: () => "Your SIIP certificate is ready",
    render: (p) => CertificateIssuedEmail(p),
  }),
  "progress-reminder": define<ProgressReminderProps>({
    subject: () => "Keep going with your SIIP training",
    render: (p) => ProgressReminderEmail(p),
  }),
  "match-reminder": define<MatchReminderProps>({
    subject: () => "SIIP candidates are waiting for your decision",
    render: (p) => MatchReminderEmail(p),
  }),
  "check-in-reminder": define<CheckInReminderProps>({
    subject: (p) => `Month ${p.month} SIIP check-in is due`,
    render: (p) => CheckInReminderEmail(p),
  }),
  "evaluation-request": define<EvaluationRequestProps>({
    subject: (p) => `Please evaluate ${p.internName}`,
    render: (p) => EvaluationRequestEmail(p),
  }),  "profile-approved": define<ProfileApprovedProps>({
    subject: () => "Your SIIP profile is approved",
    render: (p) => ProfileApprovedEmail(p),
  }),
  "profile-changes-requested": define<ChangesRequestedProps>({
    subject: () => "SIIP needs more documents from you",
    render: (p) => ChangesRequestedEmail(p),
  }),
  "profile-removed": define<ProfileRemovedProps>({
    subject: () => "Your SIIP profile has been removed",
    render: (p) => ProfileRemovedEmail(p),
  }),
};

export type TemplateName = keyof typeof templates;
export type TemplateProps<N extends TemplateName> = Parameters<(typeof templates)[N]["render"]>[0];
