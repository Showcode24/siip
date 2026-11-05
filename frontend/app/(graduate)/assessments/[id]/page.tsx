"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, Shuffle, Timer, Wifi } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { errorMessage } from "@/client/api/http";
import { assessmentApi } from "@/client/api/learning";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, NoAccess, PageHeader } from "@/components/ui/display";

export default function AssessmentIntroPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const q = useQuery({ queryKey: ["graduate", "assessments"], queryFn: assessmentApi.listMine });
  const start = useMutation({
    mutationFn: () => assessmentApi.start(id),
    onSuccess: (attempt) => router.push(`/assessments/attempt/${attempt.id}`),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <QueryState query={q}>
      {(list) => {
        const a = list.find((x) => x.id === id);
        if (!a) return <NoAccess description="This test isn't available to you." />;
        return (
          <div className="mx-auto max-w-2xl">
            <PageHeader
              breadcrumbs={[{ label: "Tests", href: "/assessments" }, { label: a.title }]}
              title={a.title}
              description={a.description ?? undefined}
            />
            <Card>
              <CardBody className="grid gap-6">
                <h2 className="text-xl">Before you start</h2>
                <ul className="grid gap-4">
                  {[
                    [
                      Timer,
                      `You have ${a.timeLimitMinutes} minutes for ${a.questionCount} questions.`,
                      "The timer keeps running if you close the page.",
                    ],
                    [
                      Clock,
                      "When time is up, your saved answers are submitted automatically.",
                      "Answers save as you go.",
                    ],
                    [
                      Shuffle,
                      "Questions appear in a different order for everyone.",
                      `You need ${a.passMark}% to pass.`,
                    ],
                    [
                      Wifi,
                      "Use a stable connection and a quiet place.",
                      `This is attempt ${a.attemptsUsed + 1} of ${a.attemptsAllowed}.`,
                    ],
                  ].map(([Icon, title, sub], i) => {
                    const I = Icon as typeof Timer;
                    return (
                      <li key={i} className="flex gap-4">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-brand-text">
                          <I className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold">{title as string}</p>
                          <p className="text-[15px] text-muted-foreground">{sub as string}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  size="lg"
                  loading={start.isPending}
                  onClick={() => start.mutate()}
                  disabled={!a.canStart}
                >
                  {a.inProgressAttemptId ? "Resume test" : "Start the test now"}
                </Button>
              </CardBody>
            </Card>
          </div>
        );
      }}
    </QueryState>
  );
}
