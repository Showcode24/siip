"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Video } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/client/api/http";
import { trainingApi } from "@/client/api/learning";
import type { AdminLesson } from "@/client/api/types";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Input, Switch, Textarea } from "@/components/ui/form-controls";
import { ConfirmDialog, Dialog, DialogClose, DialogTrigger, SheetContent } from "@/components/ui/overlays";

export default function CourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const key = ["admin", "course", courseId];
  const q = useQuery({ queryKey: key, queryFn: () => trainingApi.getCourse(courseId) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["admin", "courses"] });
  };
  const fail = (e: unknown) => toast.error(errorMessage(e));
  const updateCourse = useMutation({
    mutationFn: (v: Parameters<typeof trainingApi.updateCourse>[1]) => trainingApi.updateCourse(courseId, v),
    onSuccess: () => {
      refresh();
      toast.success("Course saved");
    },
    onError: fail,
  });
  const deleteCourse = useMutation({
    mutationFn: () => trainingApi.deleteCourse(courseId),
    onSuccess: () => {
      refresh();
      router.push("/admin/training");
      toast.success("Course deleted");
    },
    onError: fail,
  });
  const [moduleTitle, setModuleTitle] = useState("");
  const addModule = useMutation({
    mutationFn: () => trainingApi.createModule(courseId, { title: moduleTitle.trim() }),
    onSuccess: () => {
      refresh();
      setModuleTitle("");
    },
    onError: fail,
  });
  const deleteModule = useMutation({
    mutationFn: trainingApi.deleteModule,
    onSuccess: refresh,
    onError: fail,
  });
  const deleteLesson = useMutation({
    mutationFn: trainingApi.deleteLesson,
    onSuccess: refresh,
    onError: fail,
  });

  return (
    <QueryState query={q}>
      {(c) => (
        <>
          <PageHeader
            breadcrumbs={[{ label: "Training content", href: "/admin/training" }, { label: c.title }]}
            title={c.title}
            description={c.description ?? undefined}
            actions={
              <>
                <label className="flex h-11 items-center gap-3 rounded-full border border-border px-4 text-[15px] font-semibold">
                  Published{" "}
                  <Switch
                    checked={c.published}
                    onCheckedChange={(v) => updateCourse.mutate({ published: v })}
                  />
                </label>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" className="text-danger">
                      <Trash2 /> Delete
                    </Button>
                  }
                  title="Delete this course?"
                  description="All its modules, lessons and graduates' progress on them are removed."
                  confirmLabel="Delete course"
                  onConfirm={() => deleteCourse.mutateAsync()}
                />
              </>
            }
          />
          <div className="grid gap-4">
            {c.modules.map((m, mi) => (
              <Card key={m.id}>
                <CardHeader
                  title={`${mi + 1}. ${m.title}`}
                  description={`${m.lessons.length} lessons`}
                  action={
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete module ${m.title}`}>
                          <Trash2 />
                        </Button>
                      }
                      title={`Delete "${m.title}"?`}
                      description="Its lessons are deleted too."
                      confirmLabel="Delete module"
                      onConfirm={() => deleteModule.mutateAsync(m.id)}
                    />
                  }
                />
                <CardBody className="grid gap-2 pt-4">
                  {m.lessons.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{l.title}</span>
                      {l.videoUrl ? (
                        <Video className="size-4 text-muted-foreground" aria-label="Has video" />
                      ) : null}
                      {l.estimatedMinutes ? (
                        <span className="text-sm text-muted-foreground">{l.estimatedMinutes} min</span>
                      ) : null}
                      <LessonEditor
                        moduleId={m.id}
                        lesson={l}
                        onSaved={refresh}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${l.title}`}>
                            <Pencil />
                          </Button>
                        }
                      />
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${l.title}`}>
                            <Trash2 />
                          </Button>
                        }
                        title={`Delete "${l.title}"?`}
                        confirmLabel="Delete lesson"
                        onConfirm={() => deleteLesson.mutateAsync(l.id)}
                      />
                    </div>
                  ))}
                  <LessonEditor
                    moduleId={m.id}
                    onSaved={refresh}
                    trigger={
                      <Button variant="outline" size="sm" className="mt-2 justify-self-start">
                        <Plus /> Add lesson
                      </Button>
                    }
                  />
                </CardBody>
              </Card>
            ))}
            <Card>
              <CardBody>
                <form
                  className="flex flex-col gap-3 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (moduleTitle.trim().length >= 2) addModule.mutate();
                  }}
                >
                  <label htmlFor="mt" className="sr-only">
                    New module title
                  </label>
                  <Input
                    id="mt"
                    placeholder="New module title"
                    value={moduleTitle}
                    onChange={(e) => setModuleTitle(e.target.value)}
                  />
                  <Button
                    type="submit"
                    loading={addModule.isPending}
                    disabled={moduleTitle.trim().length < 2}
                  >
                    <Plus /> Add module
                  </Button>
                </form>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </QueryState>
  );
}

function LessonEditor({
  moduleId,
  lesson,
  trigger,
  onSaved,
}: {
  moduleId: string;
  lesson?: AdminLesson;
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    title: lesson?.title ?? "",
    content: lesson?.content ?? "",
    videoUrl: lesson?.videoUrl ?? "",
    minutes: lesson?.estimatedMinutes ?? 10,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: v.title.trim(),
        content: v.content || null,
        videoUrl: v.videoUrl.trim() || null,
        estimatedMinutes: v.minutes || null,
      };
      return lesson ? trainingApi.updateLesson(lesson.id, body) : trainingApi.createLesson(moduleId, body);
    },
    onSuccess: () => {
      onSaved();
      setOpen(false);
      toast.success(lesson ? "Lesson saved" : "Lesson added");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const badVideo = v.videoUrl.trim() !== "" && !/^https:\/\//.test(v.videoUrl.trim());
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <SheetContent
        title={lesson ? "Edit lesson" : "New lesson"}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={v.title.trim().length < 2 || badVideo}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Save lesson
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <Field label="Title" required>
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Lesson text" hint="Separate paragraphs with a blank line.">
            <Textarea rows={10} value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} />
          </Field>
          <Field
            label="Video link"
            optional
            hint="An https embed link, e.g. YouTube's embed URL."
            error={badVideo ? "Use an https link" : undefined}
          >
            <Input type="url" value={v.videoUrl} onChange={(e) => setV({ ...v, videoUrl: e.target.value })} />
          </Field>
          <Field label="Estimated minutes" optional>
            <Input
              type="number"
              min={1}
              max={600}
              className="max-w-32"
              value={v.minutes}
              onChange={(e) => setV({ ...v, minutes: Number(e.target.value) })}
            />
          </Field>
        </div>
      </SheetContent>
    </Dialog>
  );
}
