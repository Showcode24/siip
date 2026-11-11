"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Award,
  Briefcase,
  ClipboardCheck,
  Hourglass,
  MailWarning,
  Search,
  Send,
  ShieldCheck,
  UserRoundPen,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { graduateApi, notificationsApi } from "@/client/api/graduate";
import { siipTestApi } from "@/client/api/learning";
import type { GraduateProfile, MySiipTest } from "@/client/api/types";
import { useSession } from "@/client/session";
import { JourneyTracker } from "@/components/graduate/journey";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Skeleton, StatusPill } from "@/components/ui/display";
import { JOURNEY, SKILL_LEVEL, SKILL_STATUS, journeyStage, type JourneyInput } from "@/lib/labels";
import { formatDate, formatRelative } from "@/lib/utils";

export default function DashboardPage() {
  const { me } = useSession();
  const apps = useQuery({ queryKey: ["graduate", "applications"], queryFn: graduateApi.listApplications });
  const profile = useQuery({ queryKey: ["graduate", "profile"], queryFn: graduateApi.getProfile });
  const test = useQuery({ queryKey: ["graduate", "siip-test"], queryFn: siipTestApi.getMine });
  const current = apps.data?.find((a) => a.status !== "REJECTED" && a.status !== "WITHDRAWN");
  const journey: JourneyInput = {
    reviewStatus: profile.data?.reviewStatus,
    appStatus: current?.status,
    siipState: test.data?.state,
  };
  const loading = apps.isPending || profile.isPending;
  const firstName = me?.name.split(" ")[0] ?? "";

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-[28px] sm:text-[34px]">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {loading ? " " : `Step ${journeyStage(journey) + 1} of 7: ${JOURNEY[journeyStage(journey)].label}`}
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardBody>{loading ? <Skeleton className="h-10" /> : <JourneyTracker journey={journey} />}</CardBody>
      </Card>

      {loading ? (
        <Skeleton className="h-52 rounded-xl" />
      ) : (
        <NextStep step={nextStepFor(journey, profile.data, test.data ?? null)} />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          {profile.data ? <SkillsCard profile={profile.data} /> : null}
        </div>
        <RecentNotifications />
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

interface StepContent {
  icon: ReactNode;
  title: string;
  body: string;
  href?: string;
  action?: string;
}

const TEST_OPEN = ["VIDEOS", "READY", "IN_PROGRESS", "COOLDOWN"];

function nextStepFor(j: JourneyInput, profile: GraduateProfile | undefined, test: MySiipTest | null): StepContent {
  const testStep: StepContent = {
    icon: <ClipboardCheck />,
    title: "Take the SIIP test",
    body: test?.message ?? "Watch the short videos, then answer the quiz.",
    href: "/assessments",
    action: "Go to the SIIP test",
  };
  if (j.appStatus === "COMPLETED") {
    return test?.state === "PASSED"
      ? {
          icon: <Award />,
          title: "You completed SIIP",
          body: "Download your certificate and share its verification link with employers.",
          href: "/certificates",
          action: "Get my certificate",
        }
      : testStep;
  }
  if (j.appStatus === "PLACED") {
    return test && TEST_OPEN.includes(test.state)
      ? testStep
      : {
          icon: <Briefcase />,
          title: "Your internship is under way",
          body: "Share a short check-in every month. The SIIP test opens 2 to 3 months in.",
          href: "/placement",
          action: "Open my internship",
        };
  }
  if (j.appStatus === "MATCHED") {
    return {
      icon: <Hourglass />,
      title: "A company is reviewing your profile",
      body: "Most companies reply within three days.",
      href: "/placement",
      action: "See details",
    };
  }
  switch (j.reviewStatus) {
    case "APPROVED":
      return {
        icon: <Search />,
        title: "You're on the waiting list",
        body: "Your skills are verified. We'll let you know as soon as a company wants to take you on.",
        href: "/settings",
        action: "Keep your profile fresh",
      };
    case "SUBMITTED":
      return {
        icon: <ShieldCheck />,
        title: "SIIP is checking your documents",
        body: "We check each skill against your proof. We'll email you when we're done.",
        href: "/settings",
        action: "See my skills",
      };
    case "CHANGES_REQUESTED":
      return {
        icon: <MailWarning />,
        title: "SIIP needs more documents",
        body: profile?.reviewNote ?? "Add the documents we asked for, then send your profile again.",
        href: "/settings",
        action: "Add documents",
      };
  }
  const todo = [...(profile?.missingForApplication ?? []), ...(profile?.skillsWithoutProof ?? []).map((n) => `proof for ${n}`)];
  return todo.length
    ? {
        icon: <UserRoundPen />,
        title: "Add your skills and proof",
        body: `Still to do: ${todo.slice(0, 3).join(", ").toLowerCase()}${todo.length > 3 ? " and more" : ""}.`,
        href: "/onboarding",
        action: "Continue",
      }
    : {
        icon: <Send />,
        title: "Send your profile for review",
        body: "Everything is ready. SIIP checks each skill against your documents.",
        href: "/onboarding",
        action: "Send for review",
      };
}

function NextStep({ step }: { step: StepContent }) {
  return (
    <section
      aria-labelledby="next-step"
      className="relative isolate overflow-hidden rounded-xl bg-night-2 p-6 text-white sm:p-8"
    >
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

/** The intern's skills and where each stands with SIIP. */
function SkillsCard({ profile }: { profile: GraduateProfile }) {
  return (
    <Card>
      <CardHeader
        title="Your skills"
        description={
          profile.reviewedAt ? `Checked by SIIP ${formatDate(profile.reviewedAt)}` : "Companies only see skills SIIP has verified."
        }
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings">Manage</Link>
          </Button>
        }
      />
      <CardBody className="pt-3">
        {profile.skills.length ? (
          <ul className="grid divide-y divide-border">
            {profile.skills.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <span className="min-w-0 flex-1 font-semibold">{s.name}</span>
                <span className="text-sm text-muted-foreground">
                  {s.status === "VERIFIED" && s.verifiedLevel ? SKILL_LEVEL[s.verifiedLevel] : `Claims ${SKILL_LEVEL[s.level]}`}
                </span>
                <StatusPill map={SKILL_STATUS} value={s.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No skills yet.</p>
        )}
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
