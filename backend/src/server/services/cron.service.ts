// Daily jobs. Each email uses an idempotency key scoped to a time bucket, so a
// cron that runs twice (or is retried) never double-sends.
import { db } from "@/server/db";
import { sendEmail, type SendEmailInput } from "@/server/email/send";
import type { TemplateName } from "@/server/email/templates";
import { env } from "@/server/env";
import { describeError, logger } from "@/server/lib/logger";
import { expireOverdueAttempts } from "./attempt.service";
import { changeCohortStatus } from "./cohort.service";
import { internshipMonth } from "./internship.service";
import { createNotification } from "./notification.service";
import { anonymiseUser, findUsersDueForAnonymisation } from "./privacy.service";

const DAY = 24 * 60 * 60 * 1000;
/** Days into an internship month before its check-in reminder goes out. */
const CHECK_IN_REMINDER_AFTER_DAYS = 21;
const MATCH_DECISION_DAYS = 3;
const EVALUATION_LEAD_DAYS = 14;

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || "there";
const fmt = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

/** Sends a reminder email; adds an in-app notification only when the email is new. */
async function remind<N extends TemplateName>(
  input: SendEmailInput<N> & { toUserId: string },
  notification: { title: string; body: string },
) {
  const result = await sendEmail(input);
  if (result === "skipped") return false;
  await createNotification(db, {
    userId: input.toUserId,
    type: `reminder.${input.template}`,
    ...notification,
  });
  return true;
}

export async function closeExpiredCohorts(now: Date) {
  const due = await db.cohort.findMany({
    where: { status: "APPLICATIONS_OPEN", applicationClosesAt: { lte: now } },
    select: { id: true },
  });
  for (const c of due) await changeCohortStatus(null, c.id, "APPLICATIONS_CLOSED", now);
  return due.length;
}

/** Weekly nudge for graduates with unfinished lessons or a pending final assessment. */
export async function remindGraduates(now: Date) {
  const week = Math.floor(now.getTime() / (7 * DAY));
  const apps = await db.application.findMany({
    where: { status: { in: ["IN_TRAINING", "FINAL_ASSESSMENT"] }, graduate: { user: { deletedAt: null } } },
    select: {
      status: true,
      cohortId: true,
      graduateId: true,
      graduate: { select: { firstName: true, user: { select: { id: true, email: true } } } },
    },
    take: 1000,
  });
  let sent = 0;
  for (const app of apps) {
    let pending: string | null = null;
    if (app.status === "IN_TRAINING") {
      const scope = { module: { course: { cohortId: app.cohortId, published: true } } };
      const [total, done] = await Promise.all([
        db.lesson.count({ where: scope }),
        db.lessonProgress.count({ where: { graduateId: app.graduateId, lesson: scope } }),
      ]);
      if (total > done) pending = `${total - done} lesson${total - done === 1 ? "" : "s"}`;
    } else {
      const final = await db.assessment.count({
        where: { type: "FINAL", published: true, OR: [{ cohortId: app.cohortId }, { cohortId: null }] },
      });
      if (final > 0) pending = "your final assessment";
    }
    if (!pending) continue;
    const user = app.graduate.user;
    const isNew = await remind(
      {
        template: "progress-reminder",
        to: user.email,
        toUserId: user.id,
        idempotencyKey: `progress-reminder:${app.graduateId}:${week}`,
        props: {
          firstName: app.graduate.firstName,
          pending,
          dashboardUrl: `${env().APP_URL}/dashboard/training`,
        },
      },
      { title: "Keep going", body: `You still have ${pending} to complete.` },
    );
    if (isNew) sent++;
  }
  return sent;
}

/** Companies with proposed matches older than 3 days (reminded every 3 days). */
export async function remindPendingMatchDecisions(now: Date) {
  const stale = await db.match.findMany({
    where: { status: "PROPOSED", createdAt: { lte: new Date(now.getTime() - MATCH_DECISION_DAYS * DAY) } },
    select: { opening: { select: { companyId: true } } },
  });
  const perCompany = new Map<string, number>();
  for (const m of stale) perCompany.set(m.opening.companyId, (perCompany.get(m.opening.companyId) ?? 0) + 1);

  const bucket = Math.floor(now.getTime() / (MATCH_DECISION_DAYS * DAY));
  let sent = 0;
  for (const [companyId, pendingCount] of perCompany) {
    const owners = await db.companyMember.findMany({
      where: { companyId, role: "OWNER", user: { deletedAt: null } },
      select: { user: { select: { id: true, name: true, email: true } } },
    });
    for (const { user } of owners) {
      const isNew = await remind(
        {
          template: "match-reminder",
          to: user.email,
          toUserId: user.id,
          idempotencyKey: `match-reminder:${companyId}:${user.id}:${bucket}`,
          props: {
            firstName: firstNameOf(user.name),
            pendingCount,
            reviewUrl: `${env().APP_URL}/company/matches`,
          },
        },
        { title: "Candidates waiting", body: `${pendingCount} candidate(s) are waiting for your decision.` },
      );
      if (isNew) sent++;
    }
  }
  return sent;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** Monthly check-in reminders to whichever party hasn't submitted for the current month. */
export async function remindCheckIns(now: Date) {
  const placements = await db.placement.findMany({
    where: { status: "ACTIVE", startDate: { lte: now } },
    select: {
      id: true,
      startDate: true,
      checkIns: { select: { authorType: true, month: true } },
      graduate: {
        select: {
          firstName: true,
          lastName: true,
          user: { select: { id: true, email: true, deletedAt: true } },
        },
      },
      supervisor: { select: { user: { select: { id: true, name: true, email: true } } } },
    },
    take: 2000,
  });
  let sent = 0;
  for (const p of placements) {
    const month = internshipMonth(p.startDate, now);
    const monthStart = addMonths(p.startDate, month - 1);
    if (now.getTime() - monthStart.getTime() < CHECK_IN_REMINDER_AFTER_DAYS * DAY) continue;
    const has = (author: "INTERN" | "SUPERVISOR") =>
      p.checkIns.some((c) => c.authorType === author && c.month === month);
    const internName = `${p.graduate.firstName} ${p.graduate.lastName}`;

    const recipients: Array<{ author: string; id: string; email: string; firstName: string; url: string }> =
      [];
    if (!has("INTERN") && !p.graduate.user.deletedAt) {
      recipients.push({
        author: "intern",
        ...p.graduate.user,
        firstName: p.graduate.firstName,
        url: `${env().APP_URL}/dashboard/placement`,
      });
    }
    if (!has("SUPERVISOR") && p.supervisor) {
      const u = p.supervisor.user;
      recipients.push({
        author: "supervisor",
        id: u.id,
        email: u.email,
        firstName: firstNameOf(u.name),
        url: `${env().APP_URL}/company/interns/${p.id}`,
      });
    }
    for (const r of recipients) {
      const isNew = await remind(
        {
          template: "check-in-reminder",
          to: r.email,
          toUserId: r.id,
          idempotencyKey: `check-in-reminder:${p.id}:${r.author}:${month}`,
          props: { firstName: r.firstName, month, internName, checkInUrl: r.url },
        },
        { title: `Month ${month} check-in due`, body: `Please submit the month ${month} check-in.` },
      );
      if (isNew) sent++;
    }
  }
  return sent;
}

/** Asks the supervisor (or owners, if none) to evaluate interns finishing within 14 days. Sent once. */
export async function requestEvaluations(now: Date) {
  const placements = await db.placement.findMany({
    where: {
      status: "ACTIVE",
      evaluation: null,
      endDate: { lte: new Date(now.getTime() + EVALUATION_LEAD_DAYS * DAY) },
    },
    select: {
      id: true,
      endDate: true,
      companyId: true,
      graduate: { select: { firstName: true, lastName: true } },
      supervisor: { select: { user: { select: { id: true, name: true, email: true } } } },
    },
    take: 2000,
  });
  let sent = 0;
  for (const p of placements) {
    const users = p.supervisor
      ? [p.supervisor.user]
      : (
          await db.companyMember.findMany({
            where: { companyId: p.companyId, role: "OWNER" },
            select: { user: { select: { id: true, name: true, email: true } } },
          })
        ).map((m) => m.user);
    const internName = `${p.graduate.firstName} ${p.graduate.lastName}`;
    for (const u of users) {
      const isNew = await remind(
        {
          template: "evaluation-request",
          to: u.email,
          toUserId: u.id,
          idempotencyKey: `evaluation-request:${p.id}:${u.id}`,
          props: {
            firstName: firstNameOf(u.name),
            internName,
            endDate: fmt(p.endDate),
            evaluationUrl: `${env().APP_URL}/company/interns/${p.id}/evaluation`,
          },
        },
        { title: "Evaluation requested", body: `Please evaluate ${internName}.` },
      );
      if (isNew) sent++;
    }
  }
  return sent;
}

export async function anonymiseDeletedUsers(now: Date) {
  const due = await findUsersDueForAnonymisation(now);
  for (const u of due) await anonymiseUser(u.id);
  return due.length;
}

const JOBS = {
  closeExpiredCohorts,
  expireOverdueAttempts,
  remindGraduates,
  remindPendingMatchDecisions,
  remindCheckIns,
  requestEvaluations,
  anonymiseDeletedUsers,
} as const;

export type DailyReport = Record<keyof typeof JOBS, { ok: boolean; count?: number }>;

/** Runs every daily job; one failing job doesn't stop the others. */
export async function runDailyJobs(now = new Date()): Promise<DailyReport> {
  const report = {} as DailyReport;
  for (const [name, job] of Object.entries(JOBS) as Array<
    [keyof typeof JOBS, (now: Date) => Promise<number>]
  >) {
    try {
      report[name] = { ok: true, count: await job(now) };
    } catch (err) {
      logger.error("Cron job failed", { job: name, ...describeError(err) });
      report[name] = { ok: false };
    }
  }
  logger.info("Daily cron finished", { report });
  return report;
}
