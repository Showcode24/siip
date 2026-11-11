"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { graduateApi } from "@/client/api/graduate";
import {
  CvSection,
  EducationSection,
  PersonalSection,
  SkillsSection,
  WorkSection,
  profileKey,
} from "@/components/graduate/profile-sections";
import { ReviewSubmitCard } from "@/components/graduate/skills-proof";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, Progress } from "@/components/ui/display";
import { cn } from "@/lib/utils";

const STEPS = ["Personal", "You and work", "Education", "Skills", "CV", "Review"] as const;

export default function OnboardingPage() {
  const q = useQuery({ queryKey: profileKey, queryFn: graduateApi.getProfile });
  const [step, setStep] = useState(0);
  const next = () => {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back =
    step > 0 ? (
      <Button type="button" variant="ghost" size="lg" onClick={() => setStep(step - 1)}>
        <ArrowLeft /> Back
      </Button>
    ) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[28px] sm:text-[34px]">Set up your profile</h1>
      <p className="mt-1 text-muted-foreground">Each step saves as you go. You can come back any time.</p>

      <QueryState query={q}>
        {(profile) => (
          <>
            <div className="mt-6 flex items-center gap-4">
              <Progress value={((step + 1) / STEPS.length) * 100} label="Setup progress" className="flex-1" />
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                Step {step + 1} of {STEPS.length}
              </span>
            </div>
            <ol className="mt-4 hidden gap-2 sm:flex" aria-label="Steps">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    aria-current={i === step ? "step" : undefined}
                    className={cn(
                      "h-9 rounded-full px-3.5 text-sm font-semibold transition-colors",
                      i === step
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-surface-muted",
                    )}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ol>
            <Card className="mt-6">
              <CardBody key={step} className="animate-fade-up">
                <h2 className="mb-5 text-xl">{STEPS[step]}</h2>
                {step === 0 ? (
                  <PersonalSection profile={profile} onSaved={next} submitLabel="Save and continue" />
                ) : null}
                {step === 1 ? (
                  <WorkSection
                    profile={profile}
                    onSaved={next}
                    submitLabel="Save and continue"
                    extra={back}
                  />
                ) : null}
                {step === 2 ? (
                  <EducationSection
                    profile={profile}
                    onSaved={next}
                    submitLabel="Save and continue"
                    extra={back}
                  />
                ) : null}
                {step === 3 ? (
                  <SkillsSection
                    profile={profile}
                    onSaved={next}
                    submitLabel="Save and continue"
                    extra={back}
                  />
                ) : null}
                {step === 4 ? <CvSection profile={profile} onSaved={next} extra={back} /> : null}
                {step === 5 ? (
                  <div className="grid gap-6">
                    <div className="flex items-center gap-5 rounded-lg bg-surface-muted p-5">
                      <div
                        className="relative grid size-20 shrink-0 place-items-center rounded-full"
                        style={{
                          background: `conic-gradient(var(--primary) 0 ${profile.completenessScore}%, var(--border) ${profile.completenessScore}% 100%)`,
                        }}
                      >
                        <span className="grid size-16 place-items-center rounded-full bg-surface font-display text-xl font-semibold">
                          {profile.completenessScore}%
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold">Profile strength</p>
                        <p className="text-sm text-muted-foreground">
                          A fuller profile helps us match you with the right company.
                        </p>
                      </div>
                    </div>
                    <ReviewSubmitCard profile={profile} />
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                      {back}
                      {profile.missingForApplication.length ? null : (
                        <Button asChild size="lg" variant="outline">
                          <Link href="/applications">Apply to a cohort</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}
