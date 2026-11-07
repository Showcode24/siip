"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Award } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/client/api/admin";
import { errorMessage } from "@/client/api/http";
import type { AdminPlacement } from "@/client/api/types";
import { CheckInList, ScoreBreakdownList } from "@/components/company/shared";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Badge, StatusPill } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/form-controls";
import { ConfirmDialog, SheetContent } from "@/components/ui/overlays";
import { PLACEMENT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

const DAY = 86_400_000;

/** 1-based month (capped at 3) and whether that month's check-ins are overdue (21+ days in). */
export function checkInStatus(p: Pick<AdminPlacement, "startDate" | "status" | "checkIns">) {
  const s = new Date(p.startDate),
    n = new Date();
  if (n < s || p.status !== "ACTIVE") return { month: 0, overdue: [] as string[] };
  const months = (n.getUTCFullYear() - s.getUTCFullYear()) * 12 + n.getUTCMonth() - s.getUTCMonth();
  const month = Math.min(3, months + (n.getUTCDate() >= s.getUTCDate() ? 0 : -1) + 1);
  const monthStart = new Date(s);
  monthStart.setUTCMonth(monthStart.getUTCMonth() + month - 1);
  if (n.getTime() - monthStart.getTime() < 21 * DAY) return { month, overdue: [] };
  const overdue = (["INTERN", "SUPERVISOR"] as const)
    .filter((a) => !p.checkIns.some((c) => c.authorType === a && c.month === month))
    .map((a) => (a === "INTERN" ? "intern" : "supervisor"));
  return { month, overdue };
}

export function PlacementPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "placement", id], queryFn: () => adminApi.getPlacement(id) });
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const done = (msg: string) => () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    toast.success(msg);
  };
  const fail = (e: unknown) => toast.error(errorMessage(e));
  const complete = useMutation({
    mutationFn: () => adminApi.completePlacement(id),
    onSuccess: done("Placement completed"),
    onError: fail,
  });
  const terminate = useMutation({
    mutationFn: () => adminApi.terminatePlacement(id, reason.trim()),
    onSuccess: done("Placement ended"),
    onError: fail,
  });
  const review = useMutation({
    mutationFn: (approved: boolean) =>
      adminApi.reviewPlacement(id, { approvedForCertificate: approved, notes: notes.trim() || undefined }),
    onSuccess: done("Review saved"),
    onError: fail,
  });
  const issue = useMutation({
    mutationFn: () => adminApi.issueCertificate(id),
    onSuccess: done("Certificate issued. The graduate has been emailed."),
    onError: fail,
  });

  return (
    <SheetContent
      title={q.data ? `${q.data.graduate.firstName} ${q.data.graduate.lastName}` : "Placement"}
      description={q.data ? `${q.data.opening.title} at ${q.data.company.name}` : undefined}
    >
      <QueryState query={q}>
        {(p) => {
          const ci = checkInStatus(p);
          const approved = p.programmeEvaluation?.approvedForCertificate;
          return (
            <div className="grid gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill map={PLACEMENT_STATUS} value={p.status} />
                {p.offeredPermanentRole ? (
                  <Badge tone="brand">
                    <Award className="size-3.5" /> Permanent offer
                  </Badge>
                ) : null}
                {ci.overdue.length ? (
                  <Badge tone="danger">
                    <AlertTriangle className="size-3.5" /> Month {ci.month} check-in overdue (
                    {ci.overdue.join(" and ")})
                  </Badge>
                ) : null}
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[15px]">
                {[
                  ["Cohort", p.application.cohort.name],
                  ["Supervisor", p.supervisor?.user.name ?? "Not assigned"],
                  ["Start", formatDate(p.startDate)],
                  ["End", formatDate(p.endDate)],
                  ["Graduate email", p.graduate.user?.email ?? "Not given"],
                  ["Match score", `${p.match.score} / 100`],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-semibold break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              {p.endReason ? (
                <p className="rounded-md bg-danger-soft p-3 text-[15px] text-danger">
                  Ended early: {p.endReason}
                </p>
              ) : null}

              {p.status === "ACTIVE" ? (
                <div className="flex flex-wrap gap-2">
                  <ConfirmDialog
                    trigger={<Button>Mark completed</Button>}
                    title="Mark this internship as completed?"
                    description="The graduate's application moves to Completed. The company can then submit its evaluation."
                    confirmLabel="Mark completed"
                    tone="primary"
                    onConfirm={() => complete.mutateAsync()}
                  />
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" className="text-danger">
                        End early
                      </Button>
                    }
                    title="End this internship early?"
                    description="This can't be undone. The graduate and company are notified."
                    confirmLabel="End internship"
                    onConfirm={async () => {
                      if (reason.trim().length < 3) {
                        toast.error("Give a reason");
                        throw new Error("reason");
                      }
                      await terminate.mutateAsync();
                    }}
                  >
                    <Field label="Reason" required>
                      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Field>
                  </ConfirmDialog>
                </div>
              ) : null}

              {p.status === "COMPLETED" ? (
                <div className="grid gap-3 rounded-lg bg-surface-muted p-4">
                  <p className="font-semibold">Certificate</p>
                  {p.certificate ? (
                    <p className="text-[15px]">
                      Issued: <b>{p.certificate.serialNumber}</b>, code {p.certificate.verificationCode}
                    </p>
                  ) : !p.evaluation ? (
                    <p className="text-[15px] text-muted-foreground">
                      Waiting for the company&apos;s final evaluation.
                    </p>
                  ) : approved ? (
                    <Button
                      loading={issue.isPending}
                      onClick={() => issue.mutate()}
                      className="justify-self-start"
                    >
                      <Award /> Issue certificate
                    </Button>
                  ) : (
                    <>
                      <Field label="Review notes" optional>
                        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                      </Field>
                      <Button
                        loading={review.isPending}
                        onClick={() => review.mutate(true)}
                        className="justify-self-start"
                      >
                        Approve for certificate
                      </Button>
                    </>
                  )}
                </div>
              ) : null}

              {p.evaluation ? (
                <div>
                  <p className="font-semibold">
                    Company evaluation, {p.evaluation.overallScore.toFixed(1)} / 5
                  </p>
                  <ul className="mt-2 grid grid-cols-2 gap-1 text-[15px]">
                    {(["punctuality", "skill", "communication", "teamwork", "initiative"] as const).map(
                      (k) => (
                        <li key={k} className="capitalize">
                          {k}: <b>{p.evaluation![k]}</b>
                        </li>
                      ),
                    )}
                  </ul>
                  <p className="mt-2 text-[15px]">
                    Would hire: <b>{p.evaluation.wouldHire ? "Yes" : "No"}</b>
                  </p>
                  {p.evaluation.comments ? (
                    <p className="mt-2 rounded-md bg-surface-muted p-3 text-[15px]">
                      {p.evaluation.comments}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div>
                <p className="mb-2 font-semibold">Check-ins</p>
                <CheckInList items={p.checkIns} />
              </div>
              <div>
                <p className="mb-2 font-semibold">Original match</p>
                <ScoreBreakdownList breakdown={p.match.scoreBreakdown} compact />
              </div>
            </div>
          );
        }}
      </QueryState>
    </SheetContent>
  );
}
