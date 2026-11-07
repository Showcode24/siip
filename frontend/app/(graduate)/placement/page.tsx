"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { checkInSchema } from "@siip/shared/validators/internship";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarDays, Globe, Hourglass, Mail, MapPin, Star, UserRound } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { graduateApi } from "@/client/api/graduate";
import type { CheckIn, Placement } from "@/client/api/types";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Progress,
  StatusPill,
} from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/form-controls";
import { PLACEMENT_STATUS, WORK_MODE } from "@/lib/labels";
import { handleFormError } from "@/lib/forms";
import { cn, formatDate } from "@/lib/utils";

/** 1-based internship month today (0 before start), capped at 3, same rule as the backend. */
function internshipMonth(start: string) {
  const s = new Date(start),
    n = new Date();
  if (n < s) return 0;
  const months = (n.getUTCFullYear() - s.getUTCFullYear()) * 12 + n.getUTCMonth() - s.getUTCMonth();
  return Math.min(3, months + (n.getUTCDate() >= s.getUTCDate() ? 0 : -1) + 1);
}

export default function PlacementPage() {
  const q = useQuery({ queryKey: ["graduate", "placement"], queryFn: graduateApi.getPlacement });
  return (
    <>
      <PageHeader title="Internship" description="Your placement, supervisor and monthly check-ins." />
      <QueryState query={q}>
        {({ match, placement }) => {
          if (placement) return <PlacementView p={placement} />;
          if (match) {
            return (
              <Card>
                <CardBody className="flex flex-col items-center py-12 text-center">
                  <span className="grid size-14 place-items-center rounded-2xl bg-warning-soft text-warning">
                    <Hourglass className="size-7" />
                  </span>
                  <h2 className="mt-4 text-2xl">{match.opening.company.name} is reviewing your profile</h2>
                  <p className="mt-2 max-w-md text-muted-foreground">
                    You&apos;ve been proposed for <b className="text-foreground">{match.opening.title}</b>.
                    Most companies decide within three days. We&apos;ll email you.
                  </p>
                </CardBody>
              </Card>
            );
          }
          return (
            <EmptyState
              title="No internship yet"
              description="Once you qualify and a company accepts your match, your internship details appear here."
              action={
                <Button asChild variant="outline">
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              }
            />
          );
        }}
      </QueryState>
    </>
  );
}

function PlacementView({ p }: { p: Placement }) {
  const total = new Date(p.endDate).getTime() - new Date(p.startDate).getTime();
  const pct = Math.round(
    Math.min(1, Math.max(0, (Date.now() - new Date(p.startDate).getTime()) / total)) * 100,
  );
  const month = internshipMonth(p.startDate);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-6">
        <Card className="overflow-hidden">
          <div className="bg-night-2 p-6 text-white sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--grey-200)]">{p.opening.title}</p>
                <h2 className="mt-1 text-3xl">{p.company.name}</h2>
              </div>
              <StatusPill map={PLACEMENT_STATUS} value={p.status} />
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Progress value={pct} label="Internship progress" className="flex-1 bg-white/15" />
              <span className="text-sm font-semibold tabular-nums">
                {p.status === "ACTIVE" ? `Month ${Math.max(month, 1)} of 3` : "Finished"}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--grey-200)]">
              {formatDate(p.startDate)} to {formatDate(p.endDate)}
            </p>
          </div>
          <CardBody className="grid gap-4 text-[15px] sm:grid-cols-2">
            {[
              [
                MapPin,
                "Location",
                `${p.opening.location ?? p.company.address ?? ""}${p.opening.state ? `, ${p.opening.state}` : ""}`,
              ],
              [Building2, "Work mode", WORK_MODE[p.opening.workMode]],
              [Globe, "Website", p.company.website ?? "Not provided"],
              [CalendarDays, "Ends", formatDate(p.endDate)],
            ].map(([Icon, k, v]) => {
              const I = Icon as typeof MapPin;
              return (
                <div key={k as string} className="flex gap-3">
                  <I className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">{k as string}</p>
                    <p className="font-semibold break-words">{v as string}</p>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
        {p.offeredPermanentRole ? (
          <div className="rounded-xl bg-orange p-6 text-[var(--grey-950)]">
            <p className="flex items-center gap-2 font-display text-xl font-semibold">
              <Star className="size-5" /> You&apos;ve been offered a permanent role
            </p>
            <p className="mt-1">Congratulations! {p.company.name} recorded a permanent job offer for you.</p>
          </div>
        ) : null}
        <CheckIns placementActive={p.status === "ACTIVE"} month={month} />
      </div>
      <Card className="content-start">
        <CardHeader title="Your supervisor" />
        <CardBody>
          {p.supervisor ? (
            <div className="grid gap-3 text-[15px]">
              <p className="flex items-center gap-3 font-semibold">
                <UserRound className="size-5 text-muted-foreground" /> {p.supervisor.user.name}
              </p>
              {p.supervisor.jobTitle ? (
                <p className="text-muted-foreground">{p.supervisor.jobTitle}</p>
              ) : null}
              <a
                href={`mailto:${p.supervisor.user.email}`}
                className="flex items-center gap-3 text-brand-text underline-offset-4 hover:underline"
              >
                <Mail className="size-5" /> {p.supervisor.user.email}
              </a>
            </div>
          ) : (
            <p className="text-muted-foreground">Your supervisor will be assigned soon.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

type CheckInValues = z.input<typeof checkInSchema>;

function CheckIns({ placementActive, month }: { placementActive: boolean; month: number }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["graduate", "check-ins"], queryFn: graduateApi.listCheckIns });
  const done = new Set(list.data?.map((c) => c.month));
  const dueMonth = [1, 2, 3].find((m) => m <= month && !done.has(m));
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CheckInValues>({
    resolver: zodResolver(checkInSchema),
    values: { month: dueMonth ?? 1, progressNote: "", challenges: "", rating: 4 },
  });
  const submit = useMutation({
    mutationFn: graduateApi.submitCheckIn,
    onSuccess: (c: CheckIn) => {
      qc.setQueryData<CheckIn[]>(["graduate", "check-ins"], (old) => [...(old ?? []), c]);
      reset();
      toast.success(`Month ${c.month} check-in sent`);
    },
  });
  return (
    <Card>
      <CardHeader
        title="Monthly check-ins"
        description="A few lines each month about how your internship is going. Only SIIP sees them."
      />
      <CardBody className="grid gap-6">
        {placementActive && dueMonth ? (
          <form
            noValidate
            className="grid gap-4 rounded-lg bg-surface-muted p-4 sm:p-5"
            onSubmit={handleSubmit(async (v) => {
              try {
                await submit.mutateAsync({ ...v, challenges: v.challenges || undefined });
              } catch (err) {
                handleFormError(err, setError);
              }
            })}
          >
            <p className="font-semibold">Month {dueMonth} check-in is due</p>
            <input type="hidden" {...register("month", { valueAsNumber: true })} />
            <Field
              label="How is it going?"
              hint="What did you work on and learn this month?"
              error={errors.progressNote?.message}
              required
            >
              <Textarea rows={4} {...register("progressNote")} />
            </Field>
            <Field label="Any challenges?" optional error={errors.challenges?.message}>
              <Textarea rows={2} {...register("challenges")} />
            </Field>
            <Field label="How would you rate this month?" optional>
              <Select {...register("rating", { valueAsNumber: true })}>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {r}: {["Very poor", "Poor", "Okay", "Good", "Excellent"][r - 1]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" loading={submit.isPending} className="justify-self-start">
              Send check-in
            </Button>
          </form>
        ) : placementActive ? (
          <p className="rounded-lg bg-success-soft px-4 py-3 text-[15px] font-medium text-success">
            You&apos;re up to date. Your next check-in opens next month.
          </p>
        ) : null}
        {list.data?.length ? (
          <ol className="grid gap-3">
            {list.data.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Month {c.month}</p>
                  {c.rating ? (
                    <p className={cn("flex items-center gap-1 text-sm text-muted-foreground")}>
                      <Star className="size-4 fill-current text-brand" /> {c.rating}/5
                    </p>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[15px] text-muted-foreground">{c.progressNote}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </CardBody>
    </Card>
  );
}
