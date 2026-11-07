"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import type { OpeningStatus } from "@siip/shared/enums";
import { companyApi } from "@/client/api/company";
import { errorMessage } from "@/client/api/http";
import { useSession } from "@/client/session";
import { OpeningForm } from "@/components/company/shared";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, PageHeader, StatusPill } from "@/components/ui/display";
import { ConfirmDialog } from "@/components/ui/overlays";
import { OPENING_STATUS } from "@/lib/labels";

export default function OpeningDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { me } = useSession();
  const isOwner = me?.companyMember?.role === "OWNER";
  const verified = me?.companyMember?.company.verificationStatus === "VERIFIED";
  const q = useQuery({ queryKey: ["company", "opening", id], queryFn: () => companyApi.getOpening(id) });
  const onDone = (msg: string) => (o: unknown) => {
    qc.setQueryData(["company", "opening", id], o);
    qc.invalidateQueries({ queryKey: ["company", "openings"] });
    toast.success(msg);
  };
  const update = useMutation({
    mutationFn: (v: Parameters<typeof companyApi.updateOpening>[1]) => companyApi.updateOpening(id, v),
    onSuccess: onDone("Changes saved"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const setStatus = useMutation({
    mutationFn: (s: OpeningStatus) => companyApi.setOpeningStatus(id, s),
    onSuccess: onDone("Status updated"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <QueryState query={q}>
      {(o) => (
        <div className="mx-auto max-w-3xl">
          <PageHeader
            breadcrumbs={[{ label: "Openings", href: "/company/openings" }, { label: o.title }]}
            title={o.title}
            description={`${o._count.placements} of ${o.slots} filled, ${o._count.matches} candidates proposed so far`}
            actions={
              <>
                <StatusPill map={OPENING_STATUS} value={o.status} />
                {isOwner && o.status !== "OPEN" ? (
                  <Button
                    loading={setStatus.isPending}
                    disabled={!verified}
                    title={verified ? undefined : "Your company must be verified first"}
                    onClick={() => setStatus.mutate("OPEN")}
                  >
                    {o.status === "DRAFT" ? "Publish" : "Reopen"}
                  </Button>
                ) : null}
                {isOwner && o.status === "OPEN" ? (
                  <ConfirmDialog
                    trigger={<Button variant="outline">Close opening</Button>}
                    title="Close this opening?"
                    description="SIIP will stop proposing new candidates. Candidates already proposed stay with you."
                    confirmLabel="Close opening"
                    tone="primary"
                    onConfirm={() => setStatus.mutateAsync("CLOSED")}
                  />
                ) : null}
              </>
            }
          />
          {!verified && o.status === "DRAFT" ? (
            <p className="mb-6 rounded-lg bg-warning-soft px-4 py-3 text-[15px] text-warning">
              You can publish once SIIP has verified your company.
            </p>
          ) : null}
          <Card>
            <CardBody>
              {isOwner ? (
                <OpeningForm
                  initial={o}
                  submitLabel="Save changes"
                  busy={update.isPending}
                  onSubmit={async (v) => {
                    await update.mutateAsync(v);
                  }}
                />
              ) : (
                <p className="text-muted-foreground">{o.description}</p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </QueryState>
  );
}
