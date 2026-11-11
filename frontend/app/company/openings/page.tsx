"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { companyApi } from "@/client/api/company";
import type { Opening } from "@/client/api/types";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader, StatusPill } from "@/components/ui/display";
import { OPENING_STATUS, formatPlace } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

const columns: ColumnDef<Opening, unknown>[] = [
  {
    accessorKey: "title",
    header: "Opening",
    cell: ({ row }) => (
      <div>
        <p className="font-semibold">{row.original.title}</p>
        <p className="text-sm text-muted-foreground">{row.original.department ?? "No department"}</p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill map={OPENING_STATUS} value={row.original.status} />,
  },
  {
    id: "slots",
    header: "Filled",
    accessorFn: (o) => o._count.placements,
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original._count.placements} of {row.original.slots}
      </span>
    ),
  },
  { id: "mode", header: "Where", accessorFn: (o) => formatPlace(o) },
  { accessorKey: "state", header: "State" },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.createdAt),
    meta: { csvValue: (o) => o.createdAt },
  },
];

export default function OpeningsPage() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["company", "openings"], queryFn: () => companyApi.listOpenings() });
  return (
    <>
      <PageHeader
        title="Openings"
        description="The internships you're offering. SIIP matches verified interns to open ones."
        actions={
          <Button asChild>
            <Link href="/company/openings/new">
              <Plus /> Post an opening
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={q.data?.items}
        isLoading={q.isPending}
        isError={q.isError}
        onRetry={() => q.refetch()}
        searchPlaceholder="Search openings"
        onRowClick={(o) => router.push(`/company/openings/${o.id}`)}
        exportName="openings"
        empty={{
          title: "No openings yet",
          description: "Post your first opening to start receiving candidates.",
          action: (
            <Button asChild>
              <Link href="/company/openings/new">Post an opening</Link>
            </Button>
          ),
        }}
      />
    </>
  );
}
