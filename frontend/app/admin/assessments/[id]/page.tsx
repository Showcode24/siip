"use client";

import { questionSchema } from "@siip/shared/validators/assessment";
import type { QuestionType } from "@siip/shared/enums";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/client/api/http";
import { assessmentApi } from "@/client/api/learning";
import type { AdminQuestion, AttemptRow } from "@/client/api/types";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Card, CardBody, PageHeader, StatusPill } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Select, Switch, Textarea } from "@/components/ui/form-controls";
import {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogTrigger,
  SheetContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/overlays";
import { ATTEMPT_STATUS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";

const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
  SHORT_TEXT: "Short answer",
};

export default function AssessmentBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const key = ["admin", "assessment", id];
  const q = useQuery({ queryKey: key, queryFn: () => assessmentApi.get(id) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["admin", "assessments"] });
  };
  const fail = (e: unknown) => toast.error(errorMessage(e));
  const update = useMutation({
    mutationFn: (v: Parameters<typeof assessmentApi.update>[1]) => assessmentApi.update(id, v),
    onSuccess: () => {
      refresh();
      toast.success("Saved");
    },
    onError: fail,
  });
  const del = useMutation({ mutationFn: assessmentApi.deleteQuestion, onSuccess: refresh, onError: fail });

  return (
    <QueryState query={q}>
      {(a) => {
        const locked = a._count.attempts > 0;
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: "Assessments", href: "/admin/assessments" }, { label: a.title }]}
              title={a.title}
              description={`${a.type === "FINAL" ? "Final assessment" : "Screening test"}, ${a._count.attempts} attempts`}
              actions={
                <label className="flex h-11 items-center gap-3 rounded-full border border-border px-4 text-[15px] font-semibold">
                  Published{" "}
                  <Switch checked={a.published} onCheckedChange={(v) => update.mutate({ published: v })} />
                </label>
              }
            />
            <Tabs defaultValue="questions">
              <TabsList>
                <TabsTrigger value="questions">Questions ({a.questions.length})</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="attempts">Attempts</TabsTrigger>
              </TabsList>
              <TabsContent value="questions" className="grid gap-4">
                {locked ? (
                  <p className="flex items-center gap-2 rounded-lg bg-info-soft px-4 py-3 text-[15px] text-info">
                    <Lock className="size-4" /> Questions are locked because graduates have already taken this
                    assessment.
                  </p>
                ) : null}
                {a.questions.map((qq, i) => (
                  <Card key={qq.id}>
                    <CardBody className="grid gap-3">
                      <div className="flex items-start gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-sm font-semibold">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{qq.prompt}</p>
                          <p className="text-sm text-muted-foreground">
                            {TYPE_LABEL[qq.type]}, {qq.points} point{qq.points > 1 ? "s" : ""}
                          </p>
                        </div>
                        {!locked ? (
                          <>
                            <QuestionEditor
                              assessmentId={id}
                              question={qq}
                              onSaved={refresh}
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label="Edit question">
                                  <Pencil />
                                </Button>
                              }
                            />
                            <ConfirmDialog
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label="Delete question">
                                  <Trash2 />
                                </Button>
                              }
                              title="Delete this question?"
                              confirmLabel="Delete"
                              onConfirm={() => del.mutateAsync(qq.id)}
                            />
                          </>
                        ) : null}
                      </div>
                      {qq.type === "SHORT_TEXT" ? (
                        <p className="pl-11 text-[15px]">Accepted: {qq.acceptedAnswers.join(", ")}</p>
                      ) : (
                        <ul className="grid gap-1.5 pl-11">
                          {qq.options.map((o) => (
                            <li key={o.id} className="flex items-center gap-2 text-[15px]">
                              {o.isCorrect ? (
                                <CheckCircle2 className="size-4 text-success" aria-label="Correct" />
                              ) : (
                                <span className="size-4" />
                              )}
                              {o.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardBody>
                  </Card>
                ))}
                {!locked ? (
                  <QuestionEditor
                    assessmentId={id}
                    onSaved={refresh}
                    trigger={
                      <Button variant="outline" className="justify-self-start">
                        <Plus /> Add question
                      </Button>
                    }
                  />
                ) : null}
              </TabsContent>
              <TabsContent value="settings">
                <SettingsForm
                  a={a}
                  locked={locked}
                  onSave={(v) => update.mutate(v)}
                  busy={update.isPending}
                />
              </TabsContent>
              <TabsContent value="attempts">
                <Attempts id={id} />
              </TabsContent>
            </Tabs>
          </>
        );
      }}
    </QueryState>
  );
}

function SettingsForm({
  a,
  locked,
  onSave,
  busy,
}: {
  a: {
    title: string;
    description: string | null;
    timeLimitMinutes: number;
    passMark: number;
    maxAttempts: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  };
  locked: boolean;
  onSave: (v: Parameters<typeof assessmentApi.update>[1]) => void;
  busy: boolean;
}) {
  const [v, setV] = useState({ ...a, description: a.description ?? "" });
  return (
    <Card>
      <CardBody>
        <form
          className="grid max-w-xl gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              title: v.title,
              description: v.description || null,
              timeLimitMinutes: v.timeLimitMinutes,
              maxAttempts: v.maxAttempts,
              shuffleQuestions: v.shuffleQuestions,
              shuffleOptions: v.shuffleOptions,
              ...(locked ? {} : { passMark: v.passMark }),
            });
          }}
        >
          <Field label="Title" required>
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Instructions" optional>
            <Textarea
              rows={3}
              value={v.description}
              onChange={(e) => setV({ ...v, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Minutes">
              <Input
                type="number"
                min={1}
                value={v.timeLimitMinutes}
                onChange={(e) => setV({ ...v, timeLimitMinutes: Number(e.target.value) })}
              />
            </Field>
            <Field label="Pass mark %" hint={locked ? "Locked" : undefined}>
              <Input
                type="number"
                min={0}
                max={100}
                disabled={locked}
                value={v.passMark}
                onChange={(e) => setV({ ...v, passMark: Number(e.target.value) })}
              />
            </Field>
            <Field label="Attempts">
              <Input
                type="number"
                min={1}
                max={10}
                value={v.maxAttempts}
                onChange={(e) => setV({ ...v, maxAttempts: Number(e.target.value) })}
              />
            </Field>
          </div>
          <label className="flex items-center justify-between gap-4">
            <span className="font-semibold">Shuffle question order</span>
            <Switch
              checked={v.shuffleQuestions}
              onCheckedChange={(x) => setV({ ...v, shuffleQuestions: x })}
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="font-semibold">Shuffle answer options</span>
            <Switch checked={v.shuffleOptions} onCheckedChange={(x) => setV({ ...v, shuffleOptions: x })} />
          </label>
          <Button type="submit" loading={busy} className="justify-self-start">
            Save settings
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function QuestionEditor({
  assessmentId,
  question,
  trigger,
  onSaved,
}: {
  assessmentId: string;
  question?: AdminQuestion;
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<QuestionType>(question?.type ?? "SINGLE_CHOICE");
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [points, setPoints] = useState(question?.points ?? 1);
  const [options, setOptions] = useState(
    question?.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) ?? [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ],
  );
  const [accepted, setAccepted] = useState(question?.acceptedAnswers.join(", ") ?? "");
  const body = {
    type,
    prompt: prompt.trim(),
    points,
    options: type === "SHORT_TEXT" ? [] : options.map((o) => ({ ...o, text: o.text.trim() })),
    acceptedAnswers:
      type === "SHORT_TEXT"
        ? accepted
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
  };
  const check = questionSchema.safeParse(body);
  const problem = check.success ? null : check.error.issues[0]?.message;
  const save = useMutation({
    mutationFn: () =>
      question
        ? assessmentApi.replaceQuestion(question.id, body)
        : assessmentApi.addQuestion(assessmentId, body),
    onSuccess: () => {
      onSaved();
      setOpen(false);
      toast.success("Question saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <SheetContent
        title={question ? "Edit question" : "New question"}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button disabled={!check.success} loading={save.isPending} onClick={() => save.mutate()}>
              Save question
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-3">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
                {Object.entries(TYPE_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Points">
              <Input
                type="number"
                min={1}
                max={100}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Question" required>
            <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </Field>
          {type === "SHORT_TEXT" ? (
            <Field
              label="Accepted answers"
              hint="Comma-separated. Matching ignores case, spaces and a final full stop."
            >
              <Input value={accepted} onChange={(e) => setAccepted(e.target.value)} />
            </Field>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[15px] font-semibold">
                Options{" "}
                <span className="font-normal text-muted-foreground">
                  (tick the correct {type === "SINGLE_CHOICE" ? "one" : "ones"})
                </span>
              </legend>
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Checkbox
                    aria-label={`Option ${i + 1} is correct`}
                    checked={o.isCorrect}
                    onCheckedChange={(v) =>
                      setOptions(
                        options.map((x, j) =>
                          type === "SINGLE_CHOICE"
                            ? { ...x, isCorrect: j === i }
                            : j === i
                              ? { ...x, isCorrect: v === true }
                              : x,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={`Option ${i + 1}`}
                    value={o.text}
                    onChange={(e) =>
                      setOptions(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove option ${i + 1}`}
                    disabled={options.length <= 2}
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start"
                disabled={options.length >= 10}
                onClick={() => setOptions([...options, { text: "", isCorrect: false }])}
              >
                <Plus /> Add option
              </Button>
            </fieldset>
          )}
          {problem && prompt ? <p className="text-sm text-warning">{problem}</p> : null}
        </div>
      </SheetContent>
    </Dialog>
  );
}

function Attempts({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "assessment", id, "attempts"],
    queryFn: () => assessmentApi.listAttempts(id),
  });
  const retake = useMutation({
    mutationFn: (graduateId: string) => assessmentApi.grantRetake(id, graduateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "assessment", id] });
      toast.success("Extra attempt granted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: ColumnDef<AttemptRow, unknown>[] = [
    {
      id: "graduate",
      header: "Graduate",
      accessorFn: (r) => `${r.graduate.firstName} ${r.graduate.lastName}`,
    },
    { accessorKey: "attemptNumber", header: "Attempt" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusPill map={ATTEMPT_STATUS} value={row.original.status} />,
    },
    {
      accessorKey: "percentage",
      header: "Score",
      cell: ({ row }) =>
        row.original.percentage === null ? (
          "Not scored"
        ) : (
          <span className="tabular-nums">{row.original.percentage}%</span>
        ),
    },
    {
      accessorKey: "passed",
      header: "Result",
      cell: ({ row }) =>
        row.original.passed === null ? (
          "Not scored"
        ) : (
          <Badge tone={row.original.passed ? "success" : "danger"}>
            {row.original.passed ? "Passed" : "Not passed"}
          </Badge>
        ),
      meta: { csvValue: (r) => (r.passed === null ? "" : r.passed ? "passed" : "failed") },
    },
    {
      accessorKey: "startedAt",
      header: "Started",
      cell: ({ row }) => formatDateTime(row.original.startedAt),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      meta: { csv: false },
      cell: ({ row }) =>
        row.original.passed === false ? (
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="outline">
                Allow retake
              </Button>
            }
            title="Allow another attempt?"
            description={`${row.original.graduate.firstName} gets one extra attempt.`}
            confirmLabel="Allow retake"
            tone="primary"
            onConfirm={() => retake.mutateAsync(row.original.graduate.id)}
          />
        ) : null,
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={q.data?.items}
      isLoading={q.isPending}
      isError={q.isError}
      onRetry={() => q.refetch()}
      searchPlaceholder="Search by graduate"
      exportName="attempts"
      empty={{ title: "No attempts yet" }}
    />
  );
}
