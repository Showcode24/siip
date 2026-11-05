"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { adminApi } from "@/client/api/admin";
import type { AuditEntry } from "@/client/api/types";
import { DataTable } from "@/components/ui/data-table";
import { Badge, PageHeader } from "@/components/ui/display";
import { formatDateTime } from "@/lib/utils";

const change = (e: AuditEntry) => {
  const before = e.before
    ? Object.entries(e.before)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(", ")
    : "";
  const after = e.after
    ? Object.entries(e.after)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(", ")
    : "";
  return before && after ? `${before} → ${after}` : after || before || "—";
};

const columns: ColumnDef<AuditEntry, unknown>[] = [
  {
    accessorKey: "createdAt",
    header: "When",
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>,
  },
  {
    id: "who",
    header: "Who",
    accessorFn: (e) => e.actorName ?? "System",
    cell: ({ row }) => <span className="font-semibold">{row.original.actorName ?? "System"}</span>,
  },
  { accessorKey: "action", header: "Action", cell: ({ row }) => <Badge>{row.original.action}</Badge> },
  {
    id: "entity",
    header: "Record",
    accessorFn: (e) => `${e.entityType} ${e.entityId}`,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.entityType} · {row.original.entityId}
      </span>
    ),
  },
  {
    id: "change",
    header: "Change",
    accessorFn: change,
    cell: ({ row }) => <span className="line-clamp-2 max-w-80 text-sm">{change(row.original)}</span>,
  },
];

export default function AuditPage() {
  const q = useQuery({ queryKey: ["admin", "audit"], queryFn: adminApi.listAudit });
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every admin action and status change: who did what, before and after, and when. Personal data is never recorded here."
      />
      <DataTable
        columns={columns}
        data={q.data?.items}
        isLoading={q.isPending}
        isError={q.isError}
        onRetry={() => q.refetch()}
        searchPlaceholder="Search actions, people or records"
        exportName="audit-log"
        pageSize={30}
        empty={{ title: "No activity yet" }}
      />
    </>
  );
}
