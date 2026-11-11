"use client";

import type { ReviewQueue } from "@siip/shared/validators/review";
import { useQueries } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { adminApi } from "@/client/api/admin";
import type { ReviewQueueRow } from "@/client/api/types";
import { Segmented } from "@/components/motion";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, StatusPill } from "@/components/ui/display";
import { Input } from "@/components/ui/form-controls";
import { INTERN_TYPE, PROFILE_REVIEW, formatLocation } from "@/lib/labels";
import { formatDate, formatRelative } from "@/lib/utils";

const QUEUES: Array<{ value: ReviewQueue; label: string; empty: string }> = [
  { value: "WAITING", label: "Waiting", empty: "Nobody is waiting for review." },
  { value: "CHANGES_REQUESTED", label: "More documents needed", empty: "No profiles are waiting on the intern." },
  { value: "APPROVED", label: "Approved", empty: "No approved profiles yet." },
  { value: "REMOVED", label: "Removed", empty: "No profiles have been removed." },
];

export default function ReviewQueuePage() {
  const [queue, setQueue] = useState<ReviewQueue>("WAITING");
  const [q, setQ] = useState("");
  const results = useQueries({
    queries: QUEUES.map((x) => ({
      queryKey: ["admin", "reviews", x.value, q.length >= 2 ? q : ""],
      queryFn: () => adminApi.listReviews(x.value, q),
    })),
  });
  const index = QUEUES.findIndex((x) => x.value === queue);
  const current = results[index];

  return (
    <>
      <PageHeader
        title="Skill reviews"
        description="Check each intern's documents against the skills and levels they claim. Only approved interns are matched with companies."
      />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          label="Review queue"
          value={queue}
          onChange={setQueue}
          options={QUEUES.map((x, i) => ({ value: x.value, label: x.label, count: results[i].data?.items.length }))}
        />
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search name or email"
            className="h-11 pl-10"
          />
        </div>
      </div>

      {current.isPending ? (
        <ListSkeleton rows={5} />
      ) : current.isError ? (
        <ErrorState onRetry={() => current.refetch()} />
      ) : current.data.items.length === 0 ? (
        <EmptyState title={q.length >= 2 ? "No one matches that search" : QUEUES[index].empty} />
      ) : (
        <ul className="grid gap-3">
          {current.data.items.map((r) => (
            <QueueRow key={r.id} row={r} queue={queue} />
          ))}
        </ul>
      )}
    </>
  );
}

function QueueRow({ row, queue }: { row: ReviewQueueRow; queue: ReviewQueue }) {
  const { skills } = row;
  const facts = [
    INTERN_TYPE[row.internType].label,
    formatLocation(row) || null,
    `${skills.total} ${skills.total === 1 ? "skill" : "skills"}, ${skills.documents} ${skills.documents === 1 ? "document" : "documents"}`,
  ].filter(Boolean);
  const when =
    queue === "REMOVED" && row.removedAt
      ? `Removed ${formatDate(row.removedAt)}`
      : row.submittedAt
        ? `Sent ${formatRelative(row.submittedAt)}`
        : null;
  return (
    <li>
      <Link
        href={`/admin/reviews/${row.id}`}
        className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors duration-150 hover:border-border-strong sm:p-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-semibold">
              {row.firstName} {row.lastName}
            </p>
            <StatusPill map={PROFILE_REVIEW} value={row.reviewStatus} />
          </div>
          <p className="truncate text-sm text-muted-foreground">{row.email}</p>
          <p className="mt-1 text-sm text-muted-foreground">{facts.join(", ")}</p>
        </div>
        <div className="hidden shrink-0 text-right text-sm sm:block">
          {skills.pending ? (
            <p className="font-semibold text-warning">{skills.pending} to check</p>
          ) : (
            <p className="text-muted-foreground">
              {skills.verified} verified{skills.rejected ? `, ${skills.rejected} not verified` : ""}
            </p>
          )}
          {when ? <p className="text-muted-foreground">{when}</p> : null}
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}
