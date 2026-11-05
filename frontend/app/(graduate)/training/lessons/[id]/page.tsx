"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Download } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { errorMessage } from "@/client/api/http";
import { trainingApi } from "@/client/api/learning";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, PageHeader, Skeleton } from "@/components/ui/display";

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const lesson = useQuery({ queryKey: ["graduate", "lesson", id], queryFn: () => trainingApi.getLesson(id) });
  const tree = useQuery({ queryKey: ["graduate", "training"], queryFn: trainingApi.getMyTraining });
  const flat = tree.data?.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons)) ?? [];
  const idx = flat.findIndex((l) => l.id === id);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  const complete = useMutation({
    mutationFn: () => trainingApi.completeLesson(id),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["graduate"] });
      if (p.completed === p.total)
        toast.success("Training complete!", { description: "Your final assessment is now open." });
      else toast.success("Lesson complete");
      if (next) router.push(`/training/lessons/${next.id}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <QueryState query={lesson} loading={<Skeleton className="h-96 rounded-xl" />}>
      {(l) => (
        <article className="mx-auto max-w-3xl">
          <PageHeader
            breadcrumbs={[
              { label: "Training", href: "/training" },
              { label: l.module.course.title, href: "/training" },
              { label: l.module.title },
            ]}
            title={l.title}
            description={l.estimatedMinutes ? `About ${l.estimatedMinutes} minutes` : undefined}
          />
          {l.videoUrl ? (
            <div className="mb-6 aspect-video overflow-hidden rounded-xl bg-night">
              <iframe
                src={l.videoUrl}
                title={`Video: ${l.title}`}
                loading="lazy"
                className="size-full"
                allow="accelerometer; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : null}
          <Card>
            <CardBody className="grid gap-4 text-[17px] leading-[1.75]">
              {(l.content ?? "").split(/\n\s*\n/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              {l.attachmentUrl ? (
                <Button asChild variant="outline" className="justify-self-start">
                  <a href={l.attachmentUrl} download>
                    <Download /> Download lesson file
                  </a>
                </Button>
              ) : null}
            </CardBody>
          </Card>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {prev ? (
              <Button asChild variant="ghost" size="lg">
                <Link href={`/training/lessons/${prev.id}`}>
                  <ArrowLeft /> Previous
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
              {l.completedAt ? (
                <>
                  <p className="flex items-center justify-center gap-2 font-semibold text-success">
                    <CheckCircle2 className="size-5" /> Completed
                  </p>
                  {next ? (
                    <Button asChild size="lg">
                      <Link href={`/training/lessons/${next.id}`}>
                        Next lesson <ArrowRight />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="lg">
                      <Link href="/training">Back to courses</Link>
                    </Button>
                  )}
                </>
              ) : (
                <Button size="lg" loading={complete.isPending} onClick={() => complete.mutate()}>
                  <CheckCircle2 /> Mark as complete{next ? " and continue" : ""}
                </Button>
              )}
            </div>
          </div>
        </article>
      )}
    </QueryState>
  );
}
