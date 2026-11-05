"use client";

import type { CompanyVerificationStatus } from "@siip/shared/enums";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/client/api/admin";
import { errorMessage } from "@/client/api/http";
import type { Company } from "@/client/api/types";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge, PageHeader, StatusPill } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogClose, DialogContent, SheetContent } from "@/components/ui/overlays";
import { COMPANY_STATUS, OPENING_STATUS } from "@/lib/labels";
import { COMPANY_NEXT } from "@/lib/flows";
import { cn, formatDate } from "@/lib/utils";

const columns: ColumnDef<Company, unknown>[] = [
  {
    accessorKey: "name",
    header: "Company",
    cell: ({ row }) => (
      <div>
        <p className="font-semibold">{row.original.name}</p>
        <p className="text-sm text-muted-foreground">{row.original.rcNumber}</p>
      </div>
    ),
  },
  { accessorKey: "industry", header: "Industry" },
  { accessorKey: "state", header: "State" },
  {
    accessorKey: "verificationStatus",
    header: "Status",
    cell: ({ row }) => <StatusPill map={COMPANY_STATUS} value={row.original.verificationStatus} />,
  },
  { id: "openings", header: "Openings", accessorFn: (c) => c._count?.openings ?? 0 },
  { accessorKey: "createdAt", header: "Registered", cell: ({ row }) => formatDate(row.original.createdAt) },
];

const TABS: Array<CompanyVerificationStatus | "ALL"> = [
  "PENDING",
  "VERIFIED",
  "SUSPENDED",
  "REJECTED",
  "ALL",
];

export default function CompaniesAdminPage() {
  const [tab, setTab] = useState<CompanyVerificationStatus | "ALL">("PENDING");
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "companies"], queryFn: () => adminApi.listCompanies() });
  const rows = q.data?.items.filter((c) => tab === "ALL" || c.verificationStatus === tab);
  return (
    <>
      <PageHeader
        title="Companies"
        description="Verify partner companies before they can publish openings and receive interns."
      />
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={cn(
              "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold",
              tab === t ? "bg-secondary text-secondary-foreground" : "bg-surface-muted text-muted-foreground",
            )}
          >
            {t === "ALL" ? "All" : COMPANY_STATUS[t].label}
            <span className="tabular-nums opacity-70">
              {t === "ALL"
                ? q.data?.items.length
                : q.data?.items.filter((c) => c.verificationStatus === t).length}
            </span>
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={q.isPending}
        isError={q.isError}
        onRetry={() => q.refetch()}
        searchPlaceholder="Search by name or RC number"
        exportName="companies"
        onRowClick={(c) => setOpenId(c.id)}
        empty={{ title: tab === "PENDING" ? "No companies waiting" : "No companies" }}
      />
      <Dialog open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        {openId ? <CompanyPanel id={openId} /> : null}
      </Dialog>
    </>
  );
}

function CompanyPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "company", id], queryFn: () => adminApi.getCompany(id) });
  const [pending, setPending] = useState<{
    to: CompanyVerificationStatus;
    label: string;
    needsReason?: boolean;
  } | null>(null);
  const [reason, setReason] = useState("");
  const act = useMutation({
    mutationFn: () => adminApi.setCompanyStatus(id, pending!.to, reason.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(`Company ${COMPANY_STATUS[pending!.to].label.toLowerCase()}`);
      setPending(null);
      setReason("");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <SheetContent
      title={q.data?.name ?? "Company"}
      description={q.data ? `${q.data.rcNumber} · ${q.data.industry}` : undefined}
    >
      <QueryState query={q}>
        {(c) => (
          <div className="grid gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill map={COMPANY_STATUS} value={c.verificationStatus} />
              {c.statusReason ? (
                <p className="text-sm text-muted-foreground">Reason: {c.statusReason}</p>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[15px]">
              {[
                ["Address", c.address],
                ["State", c.state],
                ["Website", c.website ?? "—"],
                ["Registered", formatDate(c.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {c.description ? <p className="text-[15px] text-muted-foreground">{c.description}</p> : null}
            <div className="flex flex-wrap gap-2">
              {COMPANY_NEXT[c.verificationStatus].map((n) => (
                <Button key={n.to} variant={n.tone} onClick={() => setPending(n)}>
                  {n.label}
                </Button>
              ))}
            </div>
            <div>
              <p className="font-semibold">Members</p>
              <ul className="mt-2 grid gap-2">
                {c.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-[15px]">
                    <span>
                      {m.user.name} <span className="text-muted-foreground">· {m.user.email}</span>
                    </span>
                    <Badge tone={m.role === "OWNER" ? "dark" : "neutral"}>
                      {m.role === "OWNER" ? "Owner" : "Supervisor"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold">Openings</p>
              {c.openings.length ? (
                <ul className="mt-2 grid gap-2">
                  {c.openings.map((o) => (
                    <li key={o.id} className="flex items-center justify-between text-[15px]">
                      <span>
                        {o.title} <span className="text-muted-foreground">· {o.slots} slots</span>
                      </span>
                      <StatusPill map={OPENING_STATUS} value={o.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[15px] text-muted-foreground">None yet.</p>
              )}
            </div>
          </div>
        )}
      </QueryState>
      <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent
          title={`${pending?.label} this company?`}
          description={
            pending?.to === "VERIFIED"
              ? "They can publish openings and receive interns. The owner is emailed."
              : pending?.to === "SUSPENDED"
                ? "Their open openings close and they stop receiving candidates."
                : "The owner sees your reason and can fix their details and resubmit."
          }
          footer={
            <>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant={pending?.to === "VERIFIED" ? "primary" : "danger"}
                disabled={Boolean(pending?.needsReason) && reason.trim().length < 3}
                loading={act.isPending}
                onClick={() => act.mutate()}
              >
                {pending?.label}
              </Button>
            </>
          }
        >
          {pending?.needsReason ? (
            <Field label="Reason (shown to the company)" required>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          ) : null}
        </DialogContent>
      </Dialog>
    </SheetContent>
  );
}
