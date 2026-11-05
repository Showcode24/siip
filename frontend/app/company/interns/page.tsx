"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { companyApi } from "@/client/api/company";
import type { Placement } from "@/client/api/types";
import { DataTable } from "@/components/ui/data-table";
import { Avatar, PageHeader, StatusPill } from "@/components/ui/display";
import { PLACEMENT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

const columns: ColumnDef<Placement, unknown>[] = [
  {
    id: "intern",
    header: "Intern",
    accessorFn: (p) => `${p.graduate.firstName} ${p.graduate.lastName}`,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar name={`${row.original.graduate.firstName} ${row.original.graduate.lastName}`} size={36} />
        <div>
          <p className="font-semibold">
            {row.original.graduate.firstName} {row.original.graduate.lastName}
          </p>
          <p className="text-sm text-muted-foreground">{row.original.graduate.courseOfStudy}</p>
        </div>
      </div>
    ),
  },
  { id: "role", header: "Role", accessorFn: (p) => p.opening.title },
  { id: "supervisor", header: "Supervisor", accessorFn: (p) => p.supervisor?.user.name ?? "Not assigned" },
  { accessorKey: "startDate", header: "Started", cell: ({ row }) => formatDate(row.original.startDate) },
  { accessorKey: "endDate", header: "Ends", cell: ({ row }) => formatDate(row.original.endDate) },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill map={PLACEMENT_STATUS} value={row.original.status} />,
  },
];

export default function InternsPage() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["company", "interns"], queryFn: companyApi.listInterns });
  return (
    <>
      <PageHeader
        title="Interns"
        description="Everyone placed with your company, with their supervisor and dates."
      />
      <DataTable
        columns={columns}
        data={q.data?.items}
        isLoading={q.isPending}
        isError={q.isError}
        onRetry={() => q.refetch()}
        searchPlaceholder="Search interns"
        onRowClick={(p) => router.push(`/company/interns/${p.id}`)}
        exportName="interns"
        empty={{ title: "No interns yet", description: "Accepted candidates appear here." }}
      />
    </>
  );
}
