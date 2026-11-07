"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, ListChecks, RotateCcw } from "lucide-react";
import Link from "next/link";
import { assessmentApi } from "@/client/api/learning";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState, PageHeader } from "@/components/ui/display";

export default function AssessmentsPage() {
  const q = useQuery({ queryKey: ["graduate", "assessments"], queryFn: assessmentApi.listMine });
  return (
    <>
      <PageHeader
        title="Tests"
        description="Your screening test and final assessment. Scores are calculated instantly and fairly."
      />
      <QueryState query={q}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title="No tests yet"
              description="Tests appear here when they're open for your stage of the programme."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((a) => {
                const last = a.attempts.at(-1);
                return (
                  <Card key={a.id}>
                    <CardBody className="grid h-full gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge tone={a.type === "FINAL" ? "brand" : "info"}>
                            {a.type === "FINAL" ? "Final assessment" : "Screening"}
                          </Badge>
                          <h2 className="mt-3 text-xl">{a.title}</h2>
                        </div>
                        {a.passed ? (
                          <Badge tone="success">
                            <CheckCircle2 className="size-3.5" /> Passed
                          </Badge>
                        ) : null}
                      </div>
                      <ul className="grid gap-2 text-[15px] text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <ListChecks className="size-4" /> {a.questionCount} questions, pass mark{" "}
                          {a.passMark}%
                        </li>
                        <li className="flex items-center gap-2">
                          <Clock className="size-4" /> {a.timeLimitMinutes} minutes
                        </li>
                        <li className="flex items-center gap-2">
                          <RotateCcw className="size-4" /> {a.attemptsUsed} of {a.attemptsAllowed} attempts
                          used
                        </li>
                      </ul>
                      {last && last.percentage !== null ? (
                        <p className="rounded-md bg-surface-muted px-4 py-3 text-[15px]">
                          Last result: <b>{last.percentage}%</b>, {last.passed ? "passed" : "not passed"}
                        </p>
                      ) : null}
                      <div className="mt-auto">
                        {a.inProgressAttemptId ? (
                          <Button asChild size="lg" className="w-full">
                            <Link href={`/assessments/attempt/${a.inProgressAttemptId}`}>Resume test</Link>
                          </Button>
                        ) : a.canStart ? (
                          <Button asChild size="lg" className="w-full">
                            <Link href={`/assessments/${a.id}`}>
                              {a.attemptsUsed ? "Try again" : "Start"}
                            </Link>
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {a.passed
                              ? "You've passed this test."
                              : a.attemptsUsed >= a.attemptsAllowed
                                ? "No attempts left. Contact SIIP if you think this is wrong."
                                : "Not open at your current stage."}
                          </p>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )
        }
      </QueryState>
    </>
  );
}
