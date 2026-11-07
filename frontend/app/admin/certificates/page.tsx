"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/client/api/admin";
import { PlacementPanel } from "@/components/admin/placement-panel";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState, PageHeader, Skeleton } from "@/components/ui/display";
import { Dialog, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { formatDate } from "@/lib/utils";

export default function CertificatesAdminPage() {
  const placements = useQuery({ queryKey: ["admin", "placements"], queryFn: adminApi.listPlacements });
  const completed = placements.data?.items.filter((p) => p.status === "COMPLETED") ?? [];
  // Admin placement detail carries the evaluation, review and certificate status.
  const details = useQueries({
    queries: completed.map((p) => ({
      queryKey: ["admin", "placement", p.id],
      queryFn: () => adminApi.getPlacement(p.id),
    })),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const loaded = details.every((d) => d.isSuccess);
  const rows = details.flatMap((d) => (d.data ? [d.data] : []));
  const queue = rows.filter((p) => !p.certificate);
  const issued = rows.filter((p) => p.certificate);

  return (
    <>
      <PageHeader
        title="Certificates"
        description="Approve completed internships and issue verifiable certificates."
      />
      <QueryState query={placements}>
        {() => (
          <Tabs defaultValue="queue">
            <TabsList>
              <TabsTrigger value="queue">
                Waiting{" "}
                {loaded ? (
                  <Badge tone={queue.length ? "brand" : "neutral"} className="h-6">
                    {queue.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="issued">
                Issued {loaded ? <Badge className="h-6">{issued.length}</Badge> : null}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="queue">
              {!loaded ? (
                <Skeleton className="h-40 rounded-xl" />
              ) : queue.length === 0 ? (
                <EmptyState
                  title="Nothing waiting"
                  description="Completed internships appear here until their certificate is issued."
                />
              ) : (
                <div className="grid gap-3">
                  {queue.map((p) => {
                    const step = !p.evaluation
                      ? { icon: Clock, label: "Waiting for company evaluation", tone: "warning" as const }
                      : !p.programmeEvaluation?.approvedForCertificate
                        ? { icon: CheckCircle2, label: "Ready for your review", tone: "brand" as const }
                        : { icon: Award, label: "Approved, ready to issue", tone: "success" as const };
                    return (
                      <Card key={p.id}>
                        <CardBody className="flex flex-wrap items-center gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">
                              {p.graduate.firstName} {p.graduate.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {p.opening.title} at {p.company.name}, ended{" "}
                              {formatDate(p.endedAt ?? p.endDate)}
                            </p>
                          </div>
                          <Badge tone={step.tone}>
                            <step.icon className="size-3.5" /> {step.label}
                          </Badge>
                          <Button
                            variant={step.tone === "warning" ? "outline" : "primary"}
                            onClick={() => setOpenId(p.id)}
                          >
                            Open
                          </Button>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            <TabsContent value="issued">
              {!loaded ? (
                <Skeleton className="h-40 rounded-xl" />
              ) : issued.length === 0 ? (
                <EmptyState title="No certificates issued yet" />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <table className="w-full min-w-[640px] text-left text-[15px]">
                    <thead className="bg-surface-muted/60 text-[13px] text-muted-foreground">
                      <tr>
                        <th className="h-11 px-4 font-semibold">Graduate</th>
                        <th className="px-4 font-semibold">Company</th>
                        <th className="px-4 font-semibold">Serial</th>
                        <th className="px-4 font-semibold">Verification code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issued.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="h-14 px-4 font-semibold">
                            {p.graduate.firstName} {p.graduate.lastName}
                          </td>
                          <td className="px-4">{p.company.name}</td>
                          <td className="px-4 tabular-nums">{p.certificate!.serialNumber}</td>
                          <td className="px-4 tabular-nums">{p.certificate!.verificationCode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </QueryState>
      <Dialog open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        {openId ? <PlacementPanel id={openId} /> : null}
      </Dialog>
    </>
  );
}
