"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { graduateApi } from "@/client/api/graduate";
import { ApiError, errorMessage } from "@/client/api/http";
import type { Cohort } from "@/client/api/types";
import { profileKey } from "@/components/graduate/profile-sections";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, EmptyState, PageHeader, StatusPill } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { APPLICATION_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export default function ApplicationsPage() {
  const apps = useQuery({ queryKey: ["graduate", "applications"], queryFn: graduateApi.listApplications });
  const cohorts = useQuery({ queryKey: ["cohorts", "open"], queryFn: graduateApi.listOpenCohorts });
  const profile = useQuery({ queryKey: profileKey, queryFn: graduateApi.getProfile });
  const active = apps.data?.find((a) => !["REJECTED", "WITHDRAWN", "COMPLETED"].includes(a.status));

  return (
    <>
      <PageHeader
        title="Applications"
        description="Apply to a cohort and follow every step of your application."
      />
      <section aria-labelledby="mine" className="grid gap-4">
        <h2 id="mine" className="text-xl">
          My applications
        </h2>
        <QueryState query={apps}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState title="No applications yet" description="Choose an open cohort below to start." />
            ) : (
              <ul className="grid gap-3">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/applications/${a.id}`}
                      className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-border-strong"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{a.cohort.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Applied {formatDate(a.createdAt)}, updated {formatDate(a.statusChangedAt)}
                        </p>
                      </div>
                      <StatusPill map={APPLICATION_STATUS} value={a.status} />
                      <ChevronRight className="size-5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )
          }
        </QueryState>
      </section>

      <section aria-labelledby="open" className="mt-10 grid gap-4">
        <h2 id="open" className="text-xl">
          Open cohorts
        </h2>
        {profile.data && profile.data.missingForApplication.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft p-5 text-warning sm:flex-row sm:items-center">
            <CircleAlert className="size-5 shrink-0" />
            <p className="flex-1 text-[15px] font-medium">
              Finish your profile to apply. Still needed:{" "}
              {profile.data.missingForApplication.join(", ").toLowerCase()}.
            </p>
            <Button asChild variant="secondary">
              <Link href="/onboarding">Finish profile</Link>
            </Button>
          </div>
        ) : null}
        <QueryState query={cohorts}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState
                title="No cohorts are open right now"
                description="We'll email you when the next cohort opens for applications."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {list.map((c) => (
                  <CohortCard
                    key={c.id}
                    cohort={c}
                    disabled={Boolean(active) || Boolean(profile.data?.missingForApplication.length)}
                    disabledReason={
                      active ? `You already have an active application (${active.cohort.name}).` : undefined
                    }
                  />
                ))}
              </div>
            )
          }
        </QueryState>
      </section>
    </>
  );
}

function CohortCard({
  cohort,
  disabled,
  disabledReason,
}: {
  cohort: Cohort;
  disabled: boolean;
  disabledReason?: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [motivation, setMotivation] = useState("");
  const apply = useMutation({
    mutationFn: () => graduateApi.apply({ cohortId: cohort.id, motivation: motivation.trim() || undefined }),
    onSuccess: (app) => {
      qc.invalidateQueries({ queryKey: ["graduate"] });
      toast.success("Application submitted", { description: "We've emailed you a confirmation." });
      router.push(`/applications/${app.id}`);
    },
    onError: (err) => {
      const missing =
        err instanceof ApiError ? (err.details as { missing?: string[] } | undefined)?.missing : undefined;
      toast.error(
        errorMessage(err),
        missing ? { description: `Still needed: ${missing.join(", ")}` } : undefined,
      );
    },
  });
  return (
    <Card>
      <CardBody className="grid gap-4">
        <div>
          <p className="font-display text-xl font-semibold">{cohort.name}</p>
          {cohort.description ? (
            <p className="mt-1 text-[15px] text-muted-foreground">{cohort.description}</p>
          ) : null}
        </div>
        <dl className="grid gap-2 text-[15px]">
          {[
            ["Applications close", cohort.applicationClosesAt],
            ["Training", cohort.trainingStartsAt],
            ["Internships start", cohort.internshipStartsAt],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="size-4" /> {k}
              </dt>
              <dd className="font-semibold">{formatDate(v)}</dd>
            </div>
          ))}
        </dl>
        {disabledReason ? <p className="text-sm text-muted-foreground">{disabledReason}</p> : null}
        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" disabled={disabled} className="w-full">
              Apply to this cohort
            </Button>
          </DialogTrigger>
          <DialogContent
            title={`Apply to ${cohort.name}`}
            description="Tell us briefly why you want to join. This is optional."
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button loading={apply.isPending} onClick={() => apply.mutate()}>
                  Submit application
                </Button>
              </>
            }
          >
            <Field label="Why do you want to join SIIP?" optional hint={`${motivation.length}/2000`}>
              <Textarea
                rows={5}
                maxLength={2000}
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
              />
            </Field>
          </DialogContent>
        </Dialog>
      </CardBody>
    </Card>
  );
}
