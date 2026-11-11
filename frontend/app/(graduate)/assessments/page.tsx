"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ListChecks, Lock, PlayCircle, RotateCcw, Timer, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/client/api/http";
import { assessmentApi, siipTestApi } from "@/client/api/learning";
import type { MySiipTest } from "@/client/api/types";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Progress } from "@/components/ui/display";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const key = ["graduate", "siip-test"] as const;

export default function SiipTestPage() {
  const q = useQuery({ queryKey: key, queryFn: siipTestApi.getMine });
  return (
    <QueryState query={q}>
      {(t) =>
        t ? (
          <SiipTest t={t} />
        ) : (
          <>
            <PageHeader title="The SIIP test" />
            <EmptyState title="The SIIP test isn't available yet" description="We'll let you know when it opens." />
          </>
        )
      }
    </QueryState>
  );
}

function SiipTest({ t }: { t: MySiipTest }) {
  const qc = useQueryClient();
  const router = useRouter();
  const watched = t.videos.filter((v) => v.watchedAt).length;
  const start = useMutation({
    mutationFn: () => assessmentApi.start(t.test.id),
    onSuccess: (attempt) => router.push(`/assessments/attempt/${attempt.id}`),
    onError: (err) => {
      toast.error(errorMessage(err));
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return (
    <>
      <PageHeader
        title={t.test.title}
        description={
          t.test.description ??
          "Short videos on working well with others, then a quiz about them."
        }
      />

      <StatusCard t={t} onStart={() => start.mutate()} starting={start.isPending} />

      <section aria-labelledby="videos-title" className="mt-8 grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="videos-title" className="text-xl">
              Step 1: watch the videos
            </h2>
            <p className="text-[15px] text-muted-foreground">Mark each one as watched. The quiz opens after the last.</p>
          </div>
          <p className="text-sm font-semibold tabular-nums">
            {watched} of {t.videos.length} watched
          </p>
        </div>
        <Progress value={t.videos.length ? (watched / t.videos.length) * 100 : 0} label="Videos watched" />
        <ol className="grid gap-4">
          {t.videos.map((v, i) => (
            <VideoCard key={v.id} index={i + 1} video={v} />
          ))}
        </ol>
      </section>

      <section aria-labelledby="quiz-title" className="mt-8">
        <Card>
          <CardHeader
            title="Step 2: the quiz"
            description="Questions about the videos. The order of questions and answers changes each time."
          />
          <CardBody className="grid gap-3">
            <ul className="grid gap-2 text-[15px] text-muted-foreground">
              <li className="flex items-center gap-2">
                <ListChecks className="size-4" aria-hidden /> {t.test.questionCount} questions, pass mark {t.test.passMark}%
              </li>
              <li className="flex items-center gap-2">
                <Clock className="size-4" aria-hidden /> {t.test.timeLimitMinutes} minutes
              </li>
              <li className="flex items-center gap-2">
                <RotateCcw className="size-4" aria-hidden /> Not passed? Try again after {t.test.retakeAfterHours} hours, as
                many times as you need.
              </li>
            </ul>
          </CardBody>
        </Card>
      </section>

      {t.attempts.length ? (
        <section aria-labelledby="attempts-title" className="mt-8">
          <h2 id="attempts-title" className="mb-3 text-xl">
            Your attempts
          </h2>
          <ul className="grid gap-2">
            {t.attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                <span className="font-semibold">Attempt {a.attemptNumber}</span>
                <span className="text-sm text-muted-foreground">{formatDateTime(a.submittedAt ?? a.startedAt)}</span>
                <span className="ml-auto flex items-center gap-3">
                  {a.percentage !== null ? <span className="font-semibold tabular-nums">{a.percentage}%</span> : null}
                  {a.status === "IN_PROGRESS" ? (
                    <Badge tone="info">In progress</Badge>
                  ) : a.passed ? (
                    <Badge tone="success">Passed</Badge>
                  ) : (
                    <Badge tone="neutral">Not passed</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function StatusCard({ t, onStart, starting }: { t: MySiipTest; onStart: () => void; starting: boolean }) {
  const router = useRouter();
  const last = t.attempts.find((a) => a.status !== "IN_PROGRESS");
  const tone: Record<MySiipTest["state"], { icon: ReactNode; className: string }> = {
    PASSED: { icon: <CheckCircle2 className="size-6" />, className: "bg-success-soft text-success" },
    LOCKED_INTERNSHIP: { icon: <Lock className="size-6" />, className: "bg-surface-muted text-foreground" },
    LOCKED_REVIEW: { icon: <Lock className="size-6" />, className: "bg-surface-muted text-foreground" },
    VIDEOS: { icon: <Video className="size-6" />, className: "bg-info-soft text-info" },
    READY: { icon: <PlayCircle className="size-6" />, className: "bg-primary-soft text-foreground" },
    IN_PROGRESS: { icon: <Timer className="size-6" />, className: "bg-primary-soft text-foreground" },
    COOLDOWN: { icon: <Clock className="size-6" />, className: "bg-warning-soft text-warning" },
  };
  const { icon, className } = tone[t.state];
  return (
    <div className={cn("flex flex-wrap items-center gap-4 rounded-xl p-5 sm:p-6", className)} role="status">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t.message}</p>
        <p className="mt-0.5 text-[15px] opacity-85">
          {t.state === "LOCKED_INTERNSHIP" && t.unlocksAt
            ? `It opens on ${formatDate(t.unlocksAt)}, once your supervisor's latest review is satisfactory.`
            : t.state === "LOCKED_INTERNSHIP"
              ? "It opens 2 to 3 months into your internship, after a satisfactory review from your supervisor."
              : t.state === "COOLDOWN" && t.nextAttemptAt
                ? `Your last score was ${last?.percentage ?? 0}%. You can try again from ${formatDateTime(t.nextAttemptAt)}.`
                : t.state === "PASSED" && last?.percentage !== undefined
                  ? `You scored ${last?.percentage}%.`
                  : t.state === "READY"
                    ? `${t.test.questionCount} questions, ${t.test.timeLimitMinutes} minutes. You need ${t.test.passMark}% to pass.`
                    : null}
        </p>
      </div>
      {t.state === "READY" ? (
        <Button size="lg" loading={starting} onClick={onStart}>
          <PlayCircle /> Start the quiz
        </Button>
      ) : t.state === "IN_PROGRESS" && t.inProgressAttemptId ? (
        <Button size="lg" onClick={() => router.push(`/assessments/attempt/${t.inProgressAttemptId}`)}>
          Resume the quiz
        </Button>
      ) : null}
    </div>
  );
}

function VideoCard({ index, video }: { index: number; video: MySiipTest["videos"][number] }) {
  const qc = useQueryClient();
  const mark = useMutation({
    mutationFn: () => siipTestApi.markWatched(video.id),
    onSuccess: (t) => qc.setQueryData(key, t),
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="aspect-video bg-night-2">
        {video.youtubeId ? (
          <iframe
            className="size-full"
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0`}
            title={video.title}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="grid size-full place-items-center p-6 text-center text-white/80">
            <div>
              <Video className="mx-auto size-8 text-orange" aria-hidden />
              <p className="mt-2 font-semibold text-white">Video coming soon</p>
              <p className="text-sm">SIIP is adding this video. You can still mark it to carry on.</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Video {index}</p>
          <p className="font-display text-lg font-semibold">{video.title}</p>
          {video.description ? <p className="text-[15px] text-muted-foreground">{video.description}</p> : null}
        </div>
        {video.watchedAt ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <CheckCircle2 className="size-4" aria-hidden /> Watched
          </p>
        ) : (
          <Button variant="outline" loading={mark.isPending} onClick={() => mark.mutate()}>
            <CheckCircle2 /> Mark as watched
          </Button>
        )}
      </div>
    </li>
  );
}
