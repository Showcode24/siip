"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, CloudCheck, Loader2, Timer, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { AnswerInput } from "@siip/shared/validators/assessment";
import { errorMessage } from "@/client/api/http";
import { assessmentApi } from "@/client/api/learning";
import type { AttemptView } from "@/client/api/types";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, Skeleton } from "@/components/ui/display";
import { Checkbox, Input } from "@/components/ui/form-controls";
import { ConfirmDialog } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";

export default function AttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const q = useQuery({
    queryKey: ["graduate", "attempt", attemptId],
    queryFn: () => assessmentApi.getAttempt(attemptId),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  return (
    <div className="min-h-dvh bg-background">
      <QueryState
        query={q}
        loading={
          <div className="mx-auto max-w-3xl p-6">
            <Skeleton className="h-96 rounded-xl" />
          </div>
        }
      >
        {(attempt) =>
          attempt.status === "IN_PROGRESS" && attempt.questions ? (
            <Exam attempt={attempt} />
          ) : (
            <Result attempt={attempt} />
          )
        }
      </QueryState>
    </div>
  );
}

type Answers = Record<string, { selectedOptionIds: string[]; textAnswer: string | null }>;

function Exam({ attempt }: { attempt: AttemptView }) {
  const qc = useQueryClient();
  const questions = attempt.questions!;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(() =>
    Object.fromEntries(
      (attempt.answers ?? []).map((a) => [
        a.questionId,
        { selectedOptionIds: a.selectedOptionIds, textAnswer: a.textAnswer },
      ]),
    ),
  );
  const dirty = useRef(new Set<string>());
  const [saveState, setSaveState] = useState<"saved" | "saving" | "idle">("idle");

  // The deadline comes from the server; correct for this device's clock drift.
  const offset = useMemo(
    () => (attempt.serverTime ? new Date(attempt.serverTime).getTime() - Date.now() : 0),
    [attempt.serverTime],
  );
  const deadline = new Date(attempt.deadlineAt).getTime();
  const [remaining, setRemaining] = useState(() => deadline - (Date.now() + offset));

  const toList = useCallback(
    (ids: Iterable<string>): AnswerInput[] =>
      [...ids].map((qid) => ({
        questionId: qid,
        selectedOptionIds: answers[qid]?.selectedOptionIds ?? [],
        textAnswer: answers[qid]?.textAnswer ?? null,
      })),
    [answers],
  );

  const submit = useMutation({
    mutationFn: () => assessmentApi.submit(attempt.id, toList(Object.keys(answers))),
    onSuccess: (res) => {
      qc.setQueryData(["graduate", "attempt", attempt.id], res);
      qc.invalidateQueries({ queryKey: ["graduate"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Autosave changed answers every few seconds.
  useEffect(() => {
    const t = setInterval(async () => {
      if (!dirty.current.size || submit.isPending) return;
      const batch = toList(dirty.current);
      dirty.current.clear();
      setSaveState("saving");
      try {
        await assessmentApi.saveAnswers(attempt.id, batch);
        setSaveState("saved");
      } catch (err) {
        batch.forEach((b) => dirty.current.add(b.questionId));
        setSaveState("idle");
        toast.error(errorMessage(err));
      }
    }, 3000);
    return () => clearInterval(t);
  }, [attempt.id, toList, submit.isPending]);

  // Countdown; submit automatically at zero.
  useEffect(() => {
    const t = setInterval(() => setRemaining(deadline - (Date.now() + offset)), 1000);
    return () => clearInterval(t);
  }, [deadline, offset]);
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (remaining <= 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      toast.info("Time is up. Submitting your answers.");
      submit.mutate();
    }
  }, [remaining, submit]);

  // Warn before leaving with unsaved answers.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current.size) e.preventDefault();
    };
    addEventListener("beforeunload", onLeave);
    return () => removeEventListener("beforeunload", onLeave);
  }, []);

  const set = (qid: string, value: Answers[string]) => {
    setAnswers((a) => ({ ...a, [qid]: value }));
    dirty.current.add(qid);
    setSaveState("idle");
  };
  const answered = (qid: string) => {
    const a = answers[qid];
    return Boolean(a && (a.selectedOptionIds.length || a.textAnswer?.trim()));
  };
  const unanswered = questions.filter((q) => !answered(q.id)).length;
  const q = questions[index];
  const secs = Math.max(0, Math.floor(remaining / 1000));
  const low = secs < 120;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-32 sm:px-6">
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{attempt.assessment.title}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            {saveState === "saving" ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Saving…
              </>
            ) : saveState === "saved" ? (
              <>
                <CloudCheck className="size-3.5" /> All answers saved
              </>
            ) : (
              "Answers save automatically"
            )}
          </p>
        </div>
        <p
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-lg font-semibold tabular-nums",
            low ? "bg-danger-soft text-danger" : "bg-surface-muted",
          )}
          role="timer"
          aria-label={`Time left: ${Math.floor(secs / 60)} minutes ${secs % 60} seconds`}
        >
          <Timer className="size-4" /> {String(Math.floor(secs / 60)).padStart(2, "0")}:
          {String(secs % 60).padStart(2, "0")}
        </p>
      </header>

      <nav aria-label="Questions" className="mt-5 flex flex-wrap gap-2">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            onClick={() => setIndex(i)}
            aria-current={i === index ? "step" : undefined}
            aria-label={`Question ${i + 1}${answered(qq.id) ? ", answered" : ", not answered"}`}
            className={cn(
              "grid size-11 place-items-center rounded-full border-2 text-sm font-semibold transition-colors",
              i === index
                ? "border-primary bg-primary text-primary-foreground"
                : answered(qq.id)
                  ? "border-secondary bg-secondary text-secondary-foreground"
                  : "border-border-strong bg-surface",
            )}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <Card className="mt-6">
        <CardBody key={q.id} className="grid gap-5">
          <p className="text-sm font-semibold text-muted-foreground">
            Question {index + 1} of {questions.length}
            {q.type === "MULTIPLE_CHOICE" ? ", choose all that apply" : ""}
          </p>
          <h1 className="text-xl leading-snug sm:text-2xl" id={`q-${q.id}`}>
            {q.prompt}
          </h1>
          {q.type === "SHORT_TEXT" ? (
            <Input
              aria-labelledby={`q-${q.id}`}
              value={answers[q.id]?.textAnswer ?? ""}
              onChange={(e) => set(q.id, { selectedOptionIds: [], textAnswer: e.target.value })}
              placeholder="Type your answer"
              maxLength={2000}
            />
          ) : (
            <div
              role={q.type === "SINGLE_CHOICE" ? "radiogroup" : "group"}
              aria-labelledby={`q-${q.id}`}
              className="grid gap-2"
            >
              {q.options.map((o) => {
                const selected = answers[q.id]?.selectedOptionIds.includes(o.id) ?? false;
                const toggle = () => {
                  const cur = answers[q.id]?.selectedOptionIds ?? [];
                  set(q.id, {
                    textAnswer: null,
                    selectedOptionIds:
                      q.type === "SINGLE_CHOICE"
                        ? [o.id]
                        : selected
                          ? cur.filter((x) => x !== o.id)
                          : [...cur, o.id],
                  });
                };
                return q.type === "SINGLE_CHOICE" ? (
                  <button
                    key={o.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={toggle}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-lg border-[1.5px] px-4 py-3 text-left text-[16px] transition-colors",
                      selected
                        ? "border-primary bg-primary-soft/50"
                        : "border-border-strong hover:border-foreground/40",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border-[1.5px]",
                        selected ? "border-primary" : "border-border-strong",
                      )}
                    >
                      {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                    </span>
                    {o.text}
                  </button>
                ) : (
                  <label
                    key={o.id}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-[1.5px] px-4 py-3 text-[16px] transition-colors",
                      selected
                        ? "border-primary bg-primary-soft/50"
                        : "border-border-strong hover:border-foreground/40",
                    )}
                  >
                    <Checkbox checked={selected} onCheckedChange={toggle} />
                    {o.text}
                  </label>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setIndex(index - 1)}
            disabled={index === 0}
            aria-label="Previous question"
          >
            <ArrowLeft />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <div className="flex-1" />
          {index < questions.length - 1 ? (
            <Button variant="secondary" size="lg" onClick={() => setIndex(index + 1)}>
              Next <ArrowRight />
            </Button>
          ) : null}
          <ConfirmDialog
            trigger={
              <Button size="lg" variant={index === questions.length - 1 ? "primary" : "outline"}>
                Submit
              </Button>
            }
            title="Submit your test?"
            description={
              unanswered
                ? `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. Unanswered questions score zero.`
                : "You've answered every question. You can't change answers after submitting."
            }
            confirmLabel="Submit test"
            tone="primary"
            onConfirm={() => submit.mutateAsync()}
          />
        </div>
      </div>
    </div>
  );
}

function Result({ attempt }: { attempt: AttemptView }) {
  const passed = attempt.result?.passed;
  return (
    <div className="mx-auto grid min-h-dvh max-w-lg place-items-center px-6 py-12">
      <div className="w-full animate-fade-up text-center">
        <span
          className={cn(
            "mx-auto grid size-20 place-items-center rounded-full",
            passed ? "bg-success-soft text-success" : "bg-surface-muted text-muted-foreground",
          )}
        >
          {passed ? <CheckCircle2 className="size-10" /> : <XCircle className="size-10" />}
        </span>
        <p className="mt-6 text-sm font-semibold text-muted-foreground">{attempt.assessment.title}</p>
        <h1 className="mt-2 text-[34px]">
          {passed ? "You passed!" : attempt.status === "EXPIRED" ? "Time ran out" : "Not quite this time"}
        </h1>
        <p className="mt-6 font-display text-7xl font-semibold tabular-nums">
          {attempt.result?.percentage ?? 0}%
        </p>
        <p className="mt-2 text-muted-foreground">Pass mark: {attempt.assessment.passMark}%</p>
        <p className="mx-auto mt-6 max-w-sm text-[15px] text-muted-foreground">
          {passed
            ? attempt.assessment.type === "FINAL"
              ? "You've qualified for placement. We'll start matching you with companies."
              : "Our team will review your application next."
            : "Check your Tests page to see if you have another attempt."}
        </p>
        <div className="mt-8 grid gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">Back to my dashboard</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/assessments">See my tests</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
