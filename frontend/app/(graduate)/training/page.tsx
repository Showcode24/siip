"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Circle, Clock, PlayCircle } from "lucide-react";
import Link from "next/link";
import { trainingApi } from "@/client/api/learning";
import type { MyTraining } from "@/client/api/types";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, EmptyState, PageHeader, Progress } from "@/components/ui/display";

function firstIncomplete(t: MyTraining) {
  for (const c of t.courses)
    for (const m of c.modules)
      for (const l of m.lessons) if (!l.completedAt) return { course: c, module: m, lesson: l };
  return null;
}

export default function TrainingPage() {
  const q = useQuery({ queryKey: ["graduate", "training"], queryFn: trainingApi.getMyTraining });
  return (
    <>
      <PageHeader
        title="Training"
        description="Practical courses for your first job. Learn at your own pace."
      />
      <QueryState query={q}>
        {(t) => {
          const next = firstIncomplete(t);
          if (!t.courses.length)
            return (
              <EmptyState
                title="No courses yet"
                description="Your cohort's courses will appear here when training starts."
              />
            );
          return (
            <div className="grid gap-6">
              <Card className="overflow-hidden">
                <CardBody className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      {next ? "Continue where you stopped" : "All lessons complete"}
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold">
                      {next ? next.lesson.title : "You've finished your training"}
                    </p>
                    <p className="mt-1 text-[15px] text-muted-foreground">
                      {next
                        ? `${next.course.title}, ${next.module.title}`
                        : t.applicationStatus === "FINAL_ASSESSMENT"
                          ? "Your final assessment is now open."
                          : "Well done."}
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <Progress value={t.progress.percent} label="Overall progress" className="flex-1" />
                      <span className="text-sm font-semibold tabular-nums">
                        {t.progress.completed}/{t.progress.total}
                      </span>
                    </div>
                  </div>
                  {next ? (
                    <Button asChild size="lg">
                      <Link href={`/training/lessons/${next.lesson.id}`}>
                        <PlayCircle /> Continue
                      </Link>
                    </Button>
                  ) : t.applicationStatus === "FINAL_ASSESSMENT" ? (
                    <Button asChild size="lg">
                      <Link href="/assessments">Take the final assessment</Link>
                    </Button>
                  ) : null}
                </CardBody>
              </Card>

              {t.courses.map((c) => (
                <section
                  key={c.id}
                  aria-labelledby={`c-${c.id}`}
                  className="rounded-xl border border-border bg-surface shadow-sm"
                >
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:p-6">
                    <div className="min-w-0 flex-1">
                      <h2 id={`c-${c.id}`} className="text-xl">
                        {c.title}
                      </h2>
                      {c.description ? (
                        <p className="mt-1 text-[15px] text-muted-foreground">{c.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 sm:w-48">
                      <Progress value={c.progress.percent} label={`${c.title} progress`} className="flex-1" />
                      <span className="text-sm font-semibold tabular-nums">{c.progress.percent}%</span>
                    </div>
                  </div>
                  {c.modules.map((m, mi) => (
                    <details
                      key={m.id}
                      open={mi === 0 || m.lessons.some((l) => l.id === next?.lesson.id)}
                      className="group border-t border-border"
                    >
                      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 sm:px-6 [&::-webkit-details-marker]:hidden">
                        <span className="flex-1 font-semibold">{m.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {m.lessons.filter((l) => l.completedAt).length}/{m.lessons.length}
                        </span>
                        <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="pb-2">
                        {m.lessons.map((l) => (
                          <li key={l.id}>
                            <Link
                              href={`/training/lessons/${l.id}`}
                              className="flex min-h-14 items-center gap-3 px-5 py-2 hover:bg-surface-muted sm:px-6"
                            >
                              {l.completedAt ? (
                                <CheckCircle2
                                  className="size-5 shrink-0 text-success"
                                  aria-label="Completed"
                                />
                              ) : (
                                <Circle
                                  className="size-5 shrink-0 text-border-strong"
                                  aria-label="Not started"
                                />
                              )}
                              <span className="flex-1 text-[15px]">{l.title}</span>
                              {l.estimatedMinutes ? (
                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock className="size-3.5" /> {l.estimatedMinutes} min
                                </span>
                              ) : null}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </section>
              ))}
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
