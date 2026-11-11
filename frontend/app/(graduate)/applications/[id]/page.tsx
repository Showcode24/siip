"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { graduateApi } from "@/client/api/graduate";
import { errorMessage } from "@/client/api/http";
import { JourneyTracker } from "@/components/graduate/journey";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, StatusPill } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/form-controls";
import { ConfirmDialog } from "@/components/ui/overlays";
import { APPLICATION_STATUS } from "@/lib/labels";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["graduate", "application", id],
    queryFn: () => graduateApi.getApplication(id),
  });
  const [reason, setReason] = useState("");
  const withdraw = useMutation({
    mutationFn: () => graduateApi.withdraw(id, reason.trim() || undefined),
    onSuccess: (app) => {
      qc.setQueryData(["graduate", "application", id], app);
      qc.invalidateQueries({ queryKey: ["graduate", "applications"] });
      toast.success("Your application has been withdrawn");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <QueryState query={q}>
      {(app) => (
        <>
          <PageHeader
            breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: app.cohort?.name ?? "Waiting list" }]}
            title={app.cohort?.name ?? "Waiting list"}
            description={`Applied ${formatDate(app.createdAt)}`}
            actions={<StatusPill map={APPLICATION_STATUS} value={app.status} />}
          />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="grid content-start gap-6">
              <Card>
                <CardBody>
                  <JourneyTracker journey={{ appStatus: app.status }} />
                </CardBody>
              </Card>
              {app.status === "REJECTED" && app.rejectionReason ? (
                <Card className="border-danger/30">
                  <CardHeader title="Why you weren't selected" />
                  <CardBody>
                    <p className="text-[15px]">{app.rejectionReason}</p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      You can apply again when the next cohort opens.
                    </p>
                  </CardBody>
                </Card>
              ) : null}
              <Card>
                <CardHeader
                  title="Timeline"
                  description="Everything that has happened with your application."
                />
                <CardBody>
                  <ol className="relative grid gap-6 border-l-2 border-border pl-6">
                    {[...app.timeline].reverse().map((e, i) => (
                      <li key={i} className="relative">
                        <span
                          className={cn(
                            "absolute top-1 -left-[33px] size-4 rounded-full border-[3px] border-surface",
                            i === 0 ? "bg-primary" : "bg-secondary",
                          )}
                        />
                        <p className="font-semibold">{APPLICATION_STATUS[e.toStatus].label}</p>
                        <p className="text-sm text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                        {e.note ? (
                          <p className="mt-1.5 rounded-md bg-surface-muted px-3 py-2 text-[15px]">{e.note}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </CardBody>
              </Card>
            </div>
            <div className="grid content-start gap-6">
              <Card>
                <CardHeader title="Cohort dates" />
                <CardBody className="grid gap-3 text-[15px]">
                  {(app.cohort
                    ? [
                        [
                          "Training",
                          `${formatDate(app.cohort.trainingStartsAt)} to ${formatDate(app.cohort.trainingEndsAt)}`,
                        ],
                        [
                          "Internship",
                          `${formatDate(app.cohort.internshipStartsAt)} to ${formatDate(app.cohort.internshipEndsAt)}`,
                        ],
                      ]
                    : []
                  ).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-muted-foreground">{k}</p>
                      <p className="font-semibold">{v}</p>
                    </div>
                  ))}
                </CardBody>
              </Card>
              {app.motivation ? (
                <Card>
                  <CardHeader title="Your motivation" />
                  <CardBody>
                    <p className="text-[15px] text-muted-foreground">{app.motivation}</p>
                  </CardBody>
                </Card>
              ) : null}
              {app.canWithdraw ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" className="w-full text-danger">
                      Withdraw application
                    </Button>
                  }
                  title="Withdraw your application?"
                  description="You won't be able to re-apply to this cohort. Any pending company match will be cancelled."
                  confirmLabel="Withdraw"
                  onConfirm={() => withdraw.mutateAsync()}
                >
                  <Field label="Reason" optional hint="Helps us improve the programme.">
                    <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                </ConfirmDialog>
              ) : null}
            </div>
          </div>
        </>
      )}
    </QueryState>
  );
}
