"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssessmentType } from "@siip/shared/enums";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/client/api/admin";
import { errorMessage } from "@/client/api/http";
import { assessmentApi } from "@/client/api/learning";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState, PageHeader } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/form-controls";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlays";

export default function AssessmentsAdminPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({ queryKey: ["admin", "assessments"], queryFn: assessmentApi.list });
  const cohorts = useQuery({ queryKey: ["admin", "cohorts"], queryFn: adminApi.listCohorts });
  const [f, setF] = useState({
    type: "FINAL" as AssessmentType,
    title: "",
    cohortId: "",
    minutes: 30,
    passMark: 60,
    attempts: 1,
  });
  const create = useMutation({
    mutationFn: () =>
      assessmentApi.create({
        type: f.type,
        title: f.title.trim(),
        cohortId: f.cohortId || null,
        timeLimitMinutes: f.minutes,
        passMark: f.passMark,
        maxAttempts: f.attempts,
      }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["admin", "assessments"] });
      router.push(`/admin/assessments/${a.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeader
        title="Assessments"
        description="Screening tests and final assessments. Scored on the server; answer keys never reach graduates."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus /> New assessment
              </Button>
            </DialogTrigger>
            <DialogContent
              title="New assessment"
              description="It starts unpublished. Add questions, then publish."
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    disabled={f.title.trim().length < 3}
                    loading={create.isPending}
                    onClick={() => create.mutate()}
                  >
                    Create
                  </Button>
                </>
              }
            >
              <div className="grid gap-4">
                <Field label="Type" required>
                  <Select
                    value={f.type}
                    onChange={(e) => setF({ ...f, type: e.target.value as AssessmentType })}
                  >
                    <option value="FINAL">Final assessment</option>
                    <option value="SCREENING">Screening test</option>
                  </Select>
                </Field>
                <Field label="Title" required>
                  <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
                </Field>
                <Field label="Cohort" hint="Leave as 'All cohorts' for a shared screening test.">
                  <Select value={f.cohortId} onChange={(e) => setF({ ...f, cohortId: e.target.value })}>
                    <option value="">All cohorts</option>
                    {cohorts.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Minutes" required>
                    <Input
                      type="number"
                      min={1}
                      value={f.minutes}
                      onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Pass mark %" required>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={f.passMark}
                      onChange={(e) => setF({ ...f, passMark: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Attempts" required>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={f.attempts}
                      onChange={(e) => setF({ ...f, attempts: Number(e.target.value) })}
                    />
                  </Field>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <QueryState query={q}>
        {(list) =>
          !list.length ? (
            <EmptyState title="No assessments yet" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/assessments/${a.id}`}
                  className="block rounded-xl transition-shadow hover:shadow-md"
                >
                  <Card className="h-full">
                    <CardBody className="grid gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={a.type === "FINAL" ? "brand" : "info"}>
                          {a.type === "FINAL" ? "Final" : "Screening"}
                        </Badge>
                        <Badge tone={a.published ? "success" : "neutral"}>
                          {a.published ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <h2 className="text-xl">{a.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {a._count.questions} questions, {a.timeLimitMinutes} min, pass {a.passMark}%,{" "}
                        {a._count.attempts} attempts
                      </p>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )
        }
      </QueryState>
    </>
  );
}
