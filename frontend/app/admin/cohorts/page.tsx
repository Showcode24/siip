"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/client/api/admin";
import { errorMessage } from "@/client/api/http";
import { CohortForm } from "@/components/admin/cohort-form";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, EmptyState, PageHeader, Progress, StatusPill } from "@/components/ui/display";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/overlays";
import { COHORT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export default function CohortsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["admin", "cohorts"], queryFn: adminApi.listCohorts });
  const create = useMutation({
    mutationFn: adminApi.createCohort,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "cohorts"] });
      setOpen(false);
      toast.success("Cohort created as a draft");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeader
        title="Cohorts"
        description="Each cohort has an application window, training dates and internship dates."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus /> New cohort
              </Button>
            </DialogTrigger>
            <SheetContent
              title="New cohort"
              description="It starts as a draft. Open applications when you're ready."
            >
              <CohortForm
                submitLabel="Create cohort"
                busy={create.isPending}
                onSubmit={(v) => create.mutate(v)}
              />
            </SheetContent>
          </Dialog>
        }
      />
      <QueryState query={q}>
        {(list) =>
          !list.length ? (
            <EmptyState
              title="No cohorts yet"
              description="Create the first cohort to start taking applications."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((c) => {
                const placed =
                  (c.applicationCounts?.SHORTLISTED ?? 0) +
                  (c.applicationCounts?.IN_TRAINING ?? 0) +
                  (c.applicationCounts?.FINAL_ASSESSMENT ?? 0) +
                  (c.applicationCounts?.QUALIFIED ?? 0) +
                  (c.applicationCounts?.MATCHED ?? 0) +
                  (c.applicationCounts?.PLACED ?? 0) +
                  (c.applicationCounts?.COMPLETED ?? 0);
                return (
                  <Link
                    key={c.id}
                    href={`/admin/cohorts/${c.id}`}
                    className="block rounded-xl transition-shadow hover:shadow-md"
                  >
                    <Card className="h-full">
                      <CardBody className="grid gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-xl">{c.name}</h2>
                            <p className="text-sm text-muted-foreground">
                              Applications {formatDate(c.applicationOpensAt)} to{" "}
                              {formatDate(c.applicationClosesAt)}
                            </p>
                          </div>
                          <StatusPill map={COHORT_STATUS} value={c.status} />
                        </div>
                        <div>
                          <div className="mb-1.5 flex justify-between text-sm">
                            <span>
                              {placed} of {c.capacity} places taken
                            </span>
                            <span className="text-muted-foreground">
                              {c._count.applications} applications
                            </span>
                          </div>
                          <Progress value={(placed / c.capacity) * 100} label="Places taken" tone="dark" />
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )
        }
      </QueryState>
    </>
  );
}
