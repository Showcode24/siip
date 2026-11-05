"use client";

import { NIGERIAN_STATES } from "@siip/shared/nigeria";
import type { ApplicationStatus } from "@siip/shared/enums";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/client/api/admin";
import { graduateApi } from "@/client/api/graduate";
import { USE_MOCKS, errorMessage } from "@/client/api/http";
import type { AdminApplicationRow } from "@/client/api/types";
import { JourneyTracker } from "@/components/graduate/journey";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge, PageHeader, StatusPill } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogClose, DialogContent, SheetContent } from "@/components/ui/overlays";
import { APPLICATION_STATUS, AVAILABILITY, DEGREE_CLASS, NYSC_STATUS } from "@/lib/labels";
import { ADMIN_SETTABLE } from "@/lib/flows";
import { formatDate, formatDateTime } from "@/lib/utils";

const columns: ColumnDef<AdminApplicationRow, unknown>[] = [
  {
    id: "name",
    header: "Applicant",
    accessorFn: (r) => `${r.graduate.firstName} ${r.graduate.lastName}`,
    cell: ({ row }) => (
      <div>
        <p className="font-semibold">
          {row.original.graduate.firstName} {row.original.graduate.lastName}
        </p>
        <p className="text-sm text-muted-foreground">{row.original.graduate.courseOfStudy}</p>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (r) => r.status,
    cell: ({ row }) => <StatusPill map={APPLICATION_STATUS} value={row.original.status} />,
  },
  { id: "cohort", header: "Cohort", accessorFn: (r) => r.cohort.name },
  { id: "institution", header: "Institution", accessorFn: (r) => r.graduate.institution ?? "" },
  { id: "state", header: "State", accessorFn: (r) => r.graduate.stateOfResidence ?? "" },
  {
    id: "skills",
    header: "Skills",
    enableSorting: false,
    accessorFn: (r) => r.graduate.skills.map((s) => s.skill.name).join(", "),
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-56 text-sm text-muted-foreground">
        {row.original.graduate.skills.map((s) => s.skill.name).join(", ")}
      </span>
    ),
  },
  {
    id: "profile",
    header: "Profile",
    accessorFn: (r) => r.graduate.completenessScore,
    cell: ({ row }) => <span className="tabular-nums">{row.original.graduate.completenessScore}%</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Applied",
    cell: ({ row }) => formatDate(row.original.createdAt),
    meta: { csvValue: (r) => r.createdAt },
  },
];

function ApplicationsScreen() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const [cohortId, setCohortId] = useState(params.get("cohortId") ?? "");
  const [status, setStatus] = useState<ApplicationStatus | "">(
    (params.get("status") as ApplicationStatus | null) ?? "",
  );
  const [state, setState] = useState("");
  const [skillId, setSkillId] = useState("");
  const [institution, setInstitution] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const cohorts = useQuery({ queryKey: ["admin", "cohorts"], queryFn: adminApi.listCohorts });
  const skills = useQuery({ queryKey: ["skills"], queryFn: graduateApi.listSkills, staleTime: Infinity });
  const query = useMemo(
    () => ({
      cohortId: cohortId || undefined,
      status: status ? [status] : undefined,
      state: (state || undefined) as never,
      skillId: skillId || undefined,
      institution: institution.length >= 2 ? institution : undefined,
    }),
    [cohortId, status, state, skillId, institution],
  );
  const q = useQuery({
    queryKey: ["admin", "applications", query],
    queryFn: () => adminApi.listApplications(query),
  });

  const [bulk, setBulk] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [bulkStatus, setBulkStatus] = useState<ApplicationStatus>("SCREENING");
  const [bulkReason, setBulkReason] = useState("");
  const runBulk = useMutation({
    mutationFn: () =>
      adminApi.bulkStatus(bulk!.ids, { status: bulkStatus, reason: bulkReason.trim() || undefined }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      bulk?.clear();
      setBulk(null);
      setBulkReason("");
      if (r.failed)
        toast.warning(`${r.succeeded} updated, ${r.failed} couldn't move`, {
          description: r.results
            .filter((x) => !x.ok)
            .slice(0, 2)
            .map((x) => x.error?.message)
            .join(" · "),
        });
      else toast.success(`${r.succeeded} applications updated`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Applications"
        description="Screen applicants, move them through the programme and keep notes."
      />
      <DataTable
        columns={columns}
        data={q.data?.items}
        isLoading={q.isPending}
        isError={q.isError}
        onRetry={() => q.refetch()}
        getRowId={(r) => r.id}
        searchPlaceholder="Search by name, course or institution"
        exportName="applications"
        onRowClick={(r) => setOpenId(r.id)}
        toolbar={
          <>
            <Select
              aria-label="Cohort"
              className="h-11 w-44"
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
            >
              <option value="">All cohorts</option>
              {cohorts.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Status"
              className="h-11 w-44"
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus | "")}
            >
              <option value="">All statuses</option>
              {(Object.keys(APPLICATION_STATUS) as ApplicationStatus[]).map((s) => (
                <option key={s} value={s}>
                  {APPLICATION_STATUS[s].label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="State"
              className="h-11 w-36"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">All states</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Skill"
              className="h-11 w-44"
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
            >
              <option value="">Any skill</option>
              {skills.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Institution"
              placeholder="Institution"
              className="h-11 w-44"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </>
        }
        bulkActions={(rows, clear) => (
          <Button size="sm" variant="primary" onClick={() => setBulk({ ids: rows.map((r) => r.id), clear })}>
            Change status
          </Button>
        )}
        empty={{ title: "No applications match", description: "Try different filters." }}
      />

      <Dialog open={Boolean(bulk)} onOpenChange={(o) => !o && setBulk(null)}>
        <DialogContent
          title={`Change status for ${bulk?.ids.length ?? 0} applications`}
          description="Each application moves only if the change is allowed from its current stage."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                loading={runBulk.isPending}
                disabled={bulkStatus === "REJECTED" && bulkReason.trim().length < 3}
                onClick={() => runBulk.mutate()}
              >
                Apply
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <Field label="New status" required>
              <Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as ApplicationStatus)}>
                {ADMIN_SETTABLE.map((s) => (
                  <option key={s} value={s}>
                    {APPLICATION_STATUS[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            {bulkStatus === "REJECTED" ? (
              <Field label="Reason (shown to graduates)" required>
                <Textarea rows={3} value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
              </Field>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        {openId ? <ApplicantPanel id={openId} /> : null}
      </Dialog>
    </>
  );
}

function ApplicantPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "application", id], queryFn: () => adminApi.getApplication(id) });
  const [to, setTo] = useState<ApplicationStatus | "">("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const move = useMutation({
    mutationFn: () =>
      adminApi.changeStatus(id, { status: to as ApplicationStatus, reason: reason.trim() || undefined }),
    onSuccess: (d) => {
      qc.setQueryData(["admin", "application", id], d);
      qc.invalidateQueries({ queryKey: ["admin", "applications"] });
      setTo("");
      setReason("");
      toast.success(`Moved to ${APPLICATION_STATUS[d.status].label}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addNote = useMutation({
    mutationFn: () => adminApi.addNote(id, note.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "application", id] });
      setNote("");
      toast.success("Note added");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const name = q.data ? `${q.data.graduate.firstName} ${q.data.graduate.lastName}` : "Applicant";
  return (
    <SheetContent
      title={name}
      description={q.data ? `${q.data.cohort.name} · applied ${formatDate(q.data.createdAt)}` : undefined}
    >
      <QueryState query={q}>
        {(a) => (
          <div className="grid gap-6">
            <div className="flex items-center justify-between gap-3">
              <StatusPill map={APPLICATION_STATUS} value={a.status} />
              {a.graduate.hasCv ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const { url } = await adminApi.getGraduateCv(a.graduate.id);
                    if (USE_MOCKS) toast.info("In demo mode there's no CV file.");
                    else window.open(url, "_blank", "noopener");
                  }}
                >
                  <FileText /> CV
                </Button>
              ) : (
                <Badge tone="warning">No CV</Badge>
              )}
            </div>
            <JourneyTracker status={a.status} />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[15px]">
              {[
                ["Email", a.graduate.user.email],
                ["Phone", a.graduate.phone ?? "—"],
                ["Institution", a.graduate.institution ?? "—"],
                ["Course", a.graduate.courseOfStudy ?? "—"],
                ["Degree", a.graduate.degreeClass ? DEGREE_CLASS[a.graduate.degreeClass] : "—"],
                ["Graduated", a.graduate.graduationYear ?? "—"],
                ["State", a.graduate.stateOfResidence ?? "—"],
                ["NYSC", NYSC_STATUS[a.graduate.nyscStatus]],
                ["Availability", a.graduate.availability ? AVAILABILITY[a.graduate.availability] : "—"],
                ["Profile", `${a.graduate.completenessScore}%`],
              ].map(([k, v]) => (
                <div key={k as string} className="min-w-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold break-words">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              {a.graduate.skills.map((s) => (
                <Badge key={s.skill.id}>{s.skill.name}</Badge>
              ))}
            </div>
            {a.motivation ? (
              <div>
                <p className="text-sm font-semibold">Motivation</p>
                <p className="mt-1 text-[15px] text-muted-foreground">{a.motivation}</p>
              </div>
            ) : null}

            {a.allowedNextStatuses.length ? (
              <div className="grid gap-3 rounded-lg bg-surface-muted p-4">
                <p className="font-semibold">Move to the next stage</p>
                <Select
                  aria-label="New status"
                  value={to}
                  onChange={(e) => setTo(e.target.value as ApplicationStatus)}
                >
                  <option value="">Choose a status</option>
                  {a.allowedNextStatuses.map((s) => (
                    <option key={s} value={s}>
                      {APPLICATION_STATUS[s].label}
                    </option>
                  ))}
                </Select>
                {to === "REJECTED" ? (
                  <Field label="Reason (shown to the graduate)" required>
                    <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                ) : null}
                <Button
                  disabled={!to || (to === "REJECTED" && reason.trim().length < 3)}
                  loading={move.isPending}
                  onClick={() => move.mutate()}
                  className="justify-self-start"
                >
                  Update status
                </Button>
              </div>
            ) : null}

            <div className="grid gap-3">
              <p className="font-semibold">
                Screening notes{" "}
                <span className="font-normal text-muted-foreground">(never shown to the graduate)</span>
              </p>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="New note"
                placeholder="Add a note"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!note.trim()}
                loading={addNote.isPending}
                onClick={() => addNote.mutate()}
                className="justify-self-start"
              >
                Add note
              </Button>
              <ul className="grid gap-2">
                {a.notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-border p-3 text-[15px]">
                    <p>{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.authorName ?? "Admin"} · {formatDateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-semibold">Timeline</p>
              <ol className="mt-2 grid gap-2 text-[15px]">
                {[...a.events].reverse().map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{APPLICATION_STATUS[e.toStatus].label}</span>
                    <span className="text-sm text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </QueryState>
    </SheetContent>
  );
}

export default function AdminApplicationsPage() {
  return (
    <Suspense>
      <ApplicationsScreen />
    </Suspense>
  );
}
