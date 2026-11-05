"use client";

import type { PlacementStatus } from "@siip/shared/enums";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { adminApi } from "@/client/api/admin";
import type { Placement } from "@/client/api/types";
import { PlacementPanel } from "@/components/admin/placement-panel";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader, StatusPill } from "@/components/ui/display";
import { Select } from "@/components/ui/form-controls";
import { Dialog } from "@/components/ui/overlays";
import { PLACEMENT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

function month(p: Placement) {
  if (p.status !== "ACTIVE") return "—";
  const s = new Date(p.startDate),
    n = new Date();
  if (n < s) return "Not started";
  const m =
    (n.getUTCFullYear() - s.getUTCFullYear()) * 12 +
    n.getUTCMonth() -
    s.getUTCMonth() +
    (n.getUTCDate() >= s.getUTCDate() ? 1 : 0);
  return `Month ${Math.min(3, Math.max(1, m))} of 3`;
}

const columns: ColumnDef<Placement, unknown>[] = [
  {
    id: "intern",
    header: "Intern",
    accessorFn: (p) => `${p.graduate.firstName} ${p.graduate.lastName}`,
    cell: ({ row }) => (
      <span className="font-semibold">
        {row.original.graduate.firstName} {row.original.graduate.lastName}
      </span>
    ),
  },
  { id: "company", header: "Company", accessorFn: (p) => p.company.name },
  { id: "role", header: "Role", accessorFn: (p) => p.opening.title },
  { id: "progress", header: "Progress", accessorFn: month },
  { accessorKey: "endDate", header: "Ends", cell: ({ row }) => formatDate(row.original.endDate) },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill map={PLACEMENT_STATUS} value={row.original.status} />,
  },
];

export default function PlacementsAdminPage() {
  const [status, setStatus] = useState<PlacementStatus | "">("ACTIVE");
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "placements"], queryFn: adminApi.listPlacements });
  return (
    <>
      <PageHeader
        title="Placements"
        description="Monitor active internships, check-ins and evaluations. Open a placement to complete or end it."
      />
      <DataTable
        columns={columns}
        data={q.data?.items.filter((p) => !status || p.status === status)}
        isLoading={q.isPending}
        isError={q.isError}
        onRetry={() => q.refetch()}
        searchPlaceholder="Search intern, company or role"
        exportName="placements"
        onRowClick={(p) => setOpenId(p.id)}
        toolbar={
          <Select
            aria-label="Status"
            className="h-11 w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value as PlacementStatus | "")}
          >
            <option value="">All statuses</option>
            {(Object.keys(PLACEMENT_STATUS) as PlacementStatus[]).map((s) => (
              <option key={s} value={s}>
                {PLACEMENT_STATUS[s].label}
              </option>
            ))}
          </Select>
        }
        empty={{ title: "No placements", description: "Placements appear when companies accept matches." }}
      />
      <Dialog open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        {openId ? <PlacementPanel id={openId} /> : null}
      </Dialog>
    </>
  );
}
