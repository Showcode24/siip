"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { notificationsApi } from "@/client/api/graduate";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { cn, formatDateTime } from "@/lib/utils";

/** Full notifications list; used by every portal. */
export function NotificationsPage() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list() });
  const read = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <Button variant="outline" loading={readAll.isPending} onClick={() => readAll.mutate()}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />
      <div className="mb-4 flex gap-2" role="group" aria-label="Filter">
        {[false, true].map((u) => (
          <button
            key={String(u)}
            onClick={() => setUnreadOnly(u)}
            aria-pressed={unreadOnly === u}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-semibold",
              unreadOnly === u
                ? "bg-secondary text-secondary-foreground"
                : "bg-surface-muted text-muted-foreground",
            )}
          >
            {u ? "Unread" : "All"}
          </button>
        ))}
      </div>
      <QueryState query={q}>
        {({ items }) => {
          const list = unreadOnly ? items.filter((n) => !n.readAt) : items;
          return list.length === 0 ? (
            <EmptyState
              title={unreadOnly ? "No unread notifications" : "No notifications yet"}
              description="Updates about your account and programme appear here."
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {list.map((n) => (
                <li key={n.id} className={cn("flex gap-4 p-4 sm:p-5", !n.readAt && "bg-primary-soft/25")}>
                  <span
                    className={cn(
                      "mt-2 size-2.5 shrink-0 rounded-full",
                      n.readAt ? "bg-transparent" : "bg-primary",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-[15px] text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                  </div>
                  {!n.readAt ? (
                    <Button variant="ghost" size="sm" onClick={() => read.mutate(n.id)}>
                      Mark read
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          );
        }}
      </QueryState>
    </>
  );
}
