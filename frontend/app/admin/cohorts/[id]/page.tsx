"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import type { CohortStatus } from "@siip/shared/enums";
import { adminApi } from "@/client/api/admin";
import { errorMessage } from "@/client/api/http";
import { CohortForm } from "@/components/admin/cohort-form";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, StatusPill } from "@/components/ui/display";
import { ConfirmDialog } from "@/components/ui/overlays";
import { APPLICATION_STATUS, COHORT_STATUS } from "@/lib/labels";
import { COHORT_NEXT } from "@/lib/flows";

export default function CohortDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "cohort", id], queryFn: () => adminApi.getCohort(id) });
  const done = (msg: string) => () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    toast.success(msg);
  };
  const update = useMutation({
    mutationFn: (v: Parameters<typeof adminApi.updateCohort>[1]) => adminApi.updateCohort(id, v),
    onSuccess: done("Cohort saved"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const status = useMutation({
    mutationFn: (s: CohortStatus) => adminApi.setCohortStatus(id, s),
    onSuccess: done("Cohort status updated"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <QueryState query={q}>
      {(c) => (
        <>
          <PageHeader
            breadcrumbs={[{ label: "Cohorts", href: "/admin/cohorts" }, { label: c.name }]}
            title={c.name}
            description={`${c._count.applications} applications · capacity ${c.capacity}`}
            actions={
              <>
                <StatusPill map={COHORT_STATUS} value={c.status} />
                {COHORT_NEXT[c.status].map((n) => (
                  <ConfirmDialog
                    key={n.to}
                    trigger={<Button variant={n.to === "ARCHIVED" ? "outline" : "primary"}>{n.label}</Button>}
                    title={`${n.label}?`}
                    description={
                      n.to === "APPLICATIONS_OPEN"
                        ? "Graduates will be able to apply straight away."
                        : n.to === "APPLICATIONS_CLOSED"
                          ? "No new applications will be accepted."
                          : "This changes the cohort's stage for everyone."
                    }
                    confirmLabel={n.label}
                    tone="primary"
                    onConfirm={() => status.mutateAsync(n.to)}
                  />
                ))}
              </>
            }
          />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="Details and dates" />
              <CardBody>
                <CohortForm
                  initial={c}
                  submitLabel="Save changes"
                  busy={update.isPending}
                  onSubmit={(v) => update.mutate(v)}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Applications by stage"
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/applications?cohortId=${c.id}`}>Open</Link>
                  </Button>
                }
              />
              <CardBody>
                <ul className="grid gap-2">
                  {(Object.keys(APPLICATION_STATUS) as Array<keyof typeof APPLICATION_STATUS>).map((s) => (
                    <li
                      key={s}
                      className="flex items-center justify-between rounded-md px-3 py-2 text-[15px] odd:bg-surface-muted/60"
                    >
                      <span>{APPLICATION_STATUS[s].label}</span>
                      <span className="font-semibold tabular-nums">{c.applicationCounts?.[s] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </QueryState>
  );
}
