"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  Hourglass,
  Search,
  UserRoundPen,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { graduateApi, notificationsApi } from "@/client/api/graduate";
import { assessmentApi, trainingApi } from "@/client/api/learning";
import type { GraduateProfile, MyApplication } from "@/client/api/types";
import { useSession } from "@/client/session";
import { JourneyTracker } from "@/components/graduate/journey";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Progress, Skeleton, StatusPill } from "@/components/ui/display";
import { APPLICATION_STATUS } from "@/lib/labels";
import { formatDate, formatRelative } from "@/lib/utils";

type AppSummary = Omit<MyApplication, "timeline" | "motivation" | "rejectionReason">;

export default function DashboardPage() {
  const { me } = useSession();
  const apps = useQuery({ queryKey: ["graduate", "applications"], queryFn: graduateApi.listApplications });
  const profile = useQuery({ queryKey: ["graduate", "profile"], queryFn: graduateApi.getProfile });
  const current =
    apps.data?.find((a) => a.status !== "REJECTED" && a.status !== "WITHDRAWN") ?? apps.data?.[0];
  const firstName = me?.name.split(" ")[0] ?? "";

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-[28px] sm:text-[34px]">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {current
            ? `${APPLICATION_STATUS[current.status].label} · ${current.cohort.name}`
            : "Let's get your application started."}
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardBody>
          {apps.isPending ? (
            <Skeleton className="h-10" />
          ) : (
            <JourneyTracker status={current?.status ?? null} />
          )}
        </CardBody>
      </Card>

      {apps.isPending || profile.isPending ? (
        <Skeleton className="h-52 rounded-xl" />
      ) : (
        <NextStep app={current} profile={profile.data} />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          {current &&
          ["IN_TRAINING", "FINAL_ASSESSMENT", "QUALIFIED", "MATCHED", "PLACED", "COMPLETED"].includes(
            current.status,
          ) ? (
            <TrainingCard />
          ) : null}
          {current ? <DatesCard app={current} /> : null}
        </div>
        <RecentNotifications />
      </div>
    </div>
  );
}

function greeting() {
  const h = Number(
    new Intl.DateTimeFormat("en-NG", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(
      new Date(),
    ),
  );
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

interface StepContent {
  icon: ReactNode;
  title: string;
  body: string;
  href?: string;
  action?: string;
}

function nextStepFor(
  app: AppSummary | undefined,
  profile: GraduateProfile | undefined,
  screeningOpen: boolean,
): StepContent {
  if (!app || app.status === "REJECTED" || app.status === "WITHDRAWN") {
    if (profile && profile.missingForApplication.length > 0) {
      return {
        icon: <UserRoundPen />,
        title: "Complete your profile",
        body: `Add ${profile.missingForApplication.slice(0, 3).join(", ").toLowerCase()}${profile.missingForApplication.length > 3 ? " and more" : ""} so you can apply.`,
        href: "/onboarding",
        action: "Continue profile",
      };
    }
    return {
      icon: <Search />,
      title: app ? "Apply to the next cohort" : "Apply to a cohort",
      body: "Your profile is ready. Choose an open cohort to apply to.",
      href: "/applications",
      action: "See open cohorts",
    };
  }
  switch (app.status) {
    case "SUBMITTED":
      return screeningOpen
        ? {
            icon: <ClipboardCheck />,
            title: "Take the screening test",
            body: "A short timed test. It helps us review your application faster.",
            href: "/assessments",
            action: "Go to the test",
          }
        : {
            icon: <Hourglass />,
            title: "We're reviewing your application",
            body: "We'll email you as soon as your application moves forward.",
            href: `/applications/${app.id}`,
            action: "View application",
          };
    case "SCREENING":
      return {
        icon: <Hourglass />,
        title: "Your application is in review",
        body: "Our team is reviewing your profile and screening result.",
        href: `/applications/${app.id}`,
        action: "View application",
      };
    case "SHORTLISTED":
      return {
        icon: <CalendarDays />,
        title: "You're shortlisted",
        body: `Training starts ${formatDate(app.cohort.trainingStartsAt)}. We'll email you when your courses open.`,
        href: `/applications/${app.id}`,
        action: "View timeline",
      };
    case "IN_TRAINING":
      return {
        icon: <BookOpen />,
        title: "Continue your training",
        body: "Finish every lesson to unlock the final assessment.",
        href: "/training",
        action: "Continue learning",
      };
    case "FINAL_ASSESSMENT":
      return {
        icon: <ClipboardCheck />,
        title: "Take your final assessment",
        body: "You've finished training. Pass the final assessment to qualify for placement.",
        href: "/assessments",
        action: "Go to the assessment",
      };
    case "QUALIFIED":
      return {
        icon: <Search />,
        title: "We're matching you with companies",
        body: "You qualified. We'll let you know as soon as a company is interested.",
        href: "/settings",
        action: "Keep your profile fresh",
      };
    case "MATCHED":
      return {
        icon: <Hourglass />,
        title: "A company is reviewing your profile",
        body: "Most companies reply within three days.",
        href: "/placement",
        action: "See details",
      };
    case "PLACED":
      return {
        icon: <Briefcase />,
        title: "Your internship is under way",
        body: "Share a short check-in every month with SIIP.",
        href: "/placement",
        action: "Open my internship",
      };
    case "COMPLETED":
      return {
        icon: <Award />,
        title: "You completed SIIP",
        body: "Download your certificate and share its verification link with employers.",
        href: "/certificates",
        action: "Get my certificate",
      };
  }
}

function NextStep({ app, profile }: { app: AppSummary | undefined; profile: GraduateProfile | undefined }) {
  const tests = useQuery({
    queryKey: ["graduate", "assessments"],
    queryFn: assessmentApi.listMine,
    enabled: app?.status === "SUBMITTED",
  });
  const step = nextStepFor(
    app,
    profile,
    Boolean(tests.data?.some((t) => t.type === "SCREENING" && t.canStart)),
  );
  return (
    <section
      aria-labelledby="next-step"
      className="relative isolate overflow-hidden rounded-xl bg-night-2 p-6 text-white sm:p-8"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_100%_100%,rgb(232_101_12/0.35),transparent_70%)]" />
      <p className="text-sm font-semibold text-orange">Your next step</p>
      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-orange [&_svg]:size-6">
            {step.icon}
          </span>
          <div>
            <h2 id="next-step" className="text-2xl sm:text-[28px]">
              {step.title}
            </h2>
            <p className="mt-1.5 max-w-lg text-[var(--grey-200)]">{step.body}</p>
          </div>
        </div>
        {step.href ? (
          <Button asChild size="lg" className="shrink-0">
            <Link href={step.href}>
              {step.action} <ArrowRight />
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function TrainingCard() {
  const q = useQuery({ queryKey: ["graduate", "training"], queryFn: trainingApi.getMyTraining });
  return (
    <Card>
      <CardHeader
        title="Training progress"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/training">Open</Link>
          </Button>
        }
      />
      <CardBody className="grid gap-5">
        {q.isPending ? (
          <Skeleton className="h-24" />
        ) : q.data ? (
          <>
            <div className="flex items-end justify-between">
              <p className="font-display text-4xl font-semibold tabular-nums">{q.data.progress.percent}%</p>
              <p className="text-sm text-muted-foreground">
                {q.data.progress.completed} of {q.data.progress.total} lessons
              </p>
            </div>
            <Progress value={q.data.progress.percent} label="Overall training progress" />
            <ul className="grid gap-3">
              {q.data.courses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 text-[15px]">
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{c.progress.percent}%</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Training progress isn&apos;t available right now.</p>
        )}
      </CardBody>
    </Card>
  );
}

function DatesCard({ app }: { app: AppSummary }) {
  const rows: Array<[string, string]> = [
    ["Training starts", app.cohort.trainingStartsAt],
    ["Internships start", app.cohort.internshipStartsAt],
  ];
  return (
    <Card>
      <CardHeader
        title={app.cohort.name}
        description="Key dates for your cohort"
        action={<StatusPill map={APPLICATION_STATUS} value={app.status} />}
      />
      <CardBody>
        <dl className="grid gap-3">
          {rows.map(([label, date]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 rounded-lg bg-surface-muted px-4 py-3"
            >
              <dt className="text-[15px]">{label}</dt>
              <dd className="font-semibold">{formatDate(date)}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

function RecentNotifications() {
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list() });
  return (
    <Card>
      <CardHeader
        title="Recent updates"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/notifications">See all</Link>
          </Button>
        }
      />
      <CardBody className="pt-3">
        {q.isPending ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !q.data?.items.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No updates yet.</p>
        ) : (
          <ul className="grid divide-y divide-border">
            {q.data.items.slice(0, 5).map((n) => (
              <li key={n.id} className="py-3">
                <p className="text-[15px] font-semibold">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatRelative(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
