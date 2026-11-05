"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/client/api/admin";
import { errorMessage } from "@/client/api/http";
import { trainingApi } from "@/client/api/learning";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState, PageHeader } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlays";

export default function TrainingAdminPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const cohorts = useQuery({ queryKey: ["admin", "cohorts"], queryFn: adminApi.listCohorts });
  const courses = useQuery({ queryKey: ["admin", "courses"], queryFn: () => trainingApi.listCourses() });
  const [form, setForm] = useState({ cohortId: "", title: "", description: "" });
  const create = useMutation({
    mutationFn: () =>
      trainingApi.createCourse({
        cohortId: form.cohortId || cohorts.data![0].id,
        title: form.title.trim(),
        description: form.description.trim() || null,
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
      toast.success("Course created");
      router.push(`/admin/training/${c.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeader
        title="Training content"
        description="Courses belong to a cohort. Graduates see published courses once they're in training."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus /> New course
              </Button>
            </DialogTrigger>
            <DialogContent
              title="New course"
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    disabled={form.title.trim().length < 2}
                    loading={create.isPending}
                    onClick={() => create.mutate()}
                  >
                    Create course
                  </Button>
                </>
              }
            >
              <div className="grid gap-4">
                <Field label="Cohort" required>
                  <Select
                    value={form.cohortId}
                    onChange={(e) => setForm({ ...form, cohortId: e.target.value })}
                  >
                    {cohorts.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Title" required>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </Field>
                <Field label="Description" optional>
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <QueryState query={courses}>
        {(list) =>
          !list.length ? (
            <EmptyState title="No courses yet" description="Create a course, then add modules and lessons." />
          ) : (
            <div className="grid gap-8">
              {cohorts.data
                ?.filter((c) => list.some((x) => x.cohortId === c.id))
                .map((c) => (
                  <section key={c.id} aria-labelledby={`co-${c.id}`}>
                    <h2 id={`co-${c.id}`} className="mb-3 text-lg">
                      {c.name}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {list
                        .filter((x) => x.cohortId === c.id)
                        .map((course) => (
                          <Link
                            key={course.id}
                            href={`/admin/training/${course.id}`}
                            className="block rounded-xl transition-shadow hover:shadow-md"
                          >
                            <Card className="h-full">
                              <CardBody className="grid gap-3">
                                <div className="flex items-start justify-between gap-3">
                                  <h3 className="text-xl">{course.title}</h3>
                                  <Badge tone={course.published ? "success" : "neutral"}>
                                    {course.published ? "Published" : "Draft"}
                                  </Badge>
                                </div>
                                {course.description ? (
                                  <p className="text-[15px] text-muted-foreground">{course.description}</p>
                                ) : null}
                                <p className="text-sm text-muted-foreground">
                                  {course.modules.length} modules ·{" "}
                                  {course.modules.reduce((n, m) => n + m.lessons.length, 0)} lessons
                                </p>
                              </CardBody>
                            </Card>
                          </Link>
                        ))}
                    </div>
                  </section>
                ))}
            </div>
          )
        }
      </QueryState>
    </>
  );
}
