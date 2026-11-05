import type { ApplicationStatus } from "@/generated/prisma/enums";
import type { TemplateName } from "@/server/email/templates";

/** In-app notification text for each application status a graduate can reach. */
export function statusNotification(status: ApplicationStatus, cohortName: string) {
  const messages: Record<ApplicationStatus, { title: string; body: string }> = {
    SUBMITTED: {
      title: "Application received",
      body: `Your application to ${cohortName} has been received.`,
    },
    SCREENING: {
      title: "Application in review",
      body: `Our team is reviewing your application to ${cohortName}.`,
    },
    SHORTLISTED: {
      title: "You have been shortlisted",
      body: `Congratulations! You have been shortlisted for ${cohortName}.`,
    },
    IN_TRAINING: {
      title: "Training has started",
      body: `Your training for ${cohortName} is open. Start your first lesson.`,
    },
    FINAL_ASSESSMENT: {
      title: "Final assessment",
      body: `You can now take the final assessment for ${cohortName}.`,
    },
    QUALIFIED: {
      title: "You have qualified",
      body: `You have qualified for placement in ${cohortName}. We are matching you with companies.`,
    },
    MATCHED: {
      title: "You have been matched",
      body: "We have proposed you to a partner company. We will let you know their decision.",
    },
    PLACED: {
      title: "You have been placed",
      body: "A company has accepted you for an internship. Check your placement details.",
    },
    COMPLETED: {
      title: "Programme completed",
      body: `You have completed ${cohortName}. Congratulations!`,
    },
    REJECTED: {
      title: "Application update",
      body: `There is an update on your application to ${cohortName}.`,
    },
    WITHDRAWN: {
      title: "Application withdrawn",
      body: `Your application to ${cohortName} has been withdrawn.`,
    },
  };
  return messages[status];
}

/** Statuses that also trigger an email. Later phases add their own (e.g. MATCHED/PLACED). */
export const STATUS_EMAIL: Partial<
  Record<
    ApplicationStatus,
    Extract<
      TemplateName,
      | "application-received"
      | "application-shortlisted"
      | "application-rejected"
      | "training-started"
      | "qualified"
    >
  >
> = {
  SUBMITTED: "application-received",
  SHORTLISTED: "application-shortlisted",
  REJECTED: "application-rejected",
  IN_TRAINING: "training-started",
  QUALIFIED: "qualified",
};
