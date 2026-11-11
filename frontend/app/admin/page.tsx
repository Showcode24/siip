"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { adminApi } from "@/client/api/admin";
import { FunnelChart } from "@/components/admin/charts";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, Skeleton, StatCard } from "@/components/ui/display";
import { APPLICATION_STATUS } from "@/lib/labels";
import { formatRelative } from "@/lib/utils";

const pct = (v: number | null) => (v === null ? "No data" : `${v}%`);

export default function AdminOverview() {
  const analytics = useQuery({ queryKey: ["admin", "analytics", ""], queryFn: () => adminApi.getAnalytics() });
  const waiting = useQuery({ queryKey: ["admin", "reviews", "WAITING", ""], queryFn: () => adminApi.listReviews("WAITING") });
  const audit = useQuery({ queryKey: ["admin", "audit"], queryFn: adminApi.listAudit });
  const companies = useQuery({
    queryKey: ["admin", "companies", "PENDING"],
    queryFn: () => adminApi.listCompanies("PENDING"),
  });

  return (
    <>
      <PageHeader
        title="Overview"
        description="How the programme is doing right now."
        actions={
          <Button asChild>
            <Link href="/admin/reviews">
              Skill reviews {waiting.data ? `(${waiting.data.items.length} waiting)` : ""} <ArrowRight />
            </Link>
          </Button>
        }
      />
      <QueryState
        query={analytics}
        loading={
          <div className="grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        }
      >
        {(a) => (
          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="On the waiting list" value={a.totals.byStage.QUALIFIED ?? 0} tone="dark" />
              <StatCard
                label="Placement rate"
                value={pct(a.rates.placementRate)}
                hint="Placed of those approved"
              />
              <StatCard
                label="Completion rate"
                value={pct(a.rates.completionRate)}
                hint="Completed of ended internships"
              />
              <StatCard
                label="Permanent offers"
                value={pct(a.rates.permanentOfferRate)}
                hint={`${a.counts.permanentOffers} offers made`}
                tone="brand"
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader title="Programme funnel" description="Approved interns who reached each stage." />
                <CardBody>
                  <FunnelChart byStage={a.totals.byStage} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="By stage"
                  action={
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/admin/applications">Open</Link>
                    </Button>
                  }
                />
                <CardBody>
                  <ul className="grid gap-2">
                    {(["QUALIFIED", "MATCHED", "PLACED", "COMPLETED"] as const).map((s) => (
                      <li
                        key={s}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-[15px] odd:bg-surface-muted/60"
                      >
                        <span>{APPLICATION_STATUS[s].label}</span>
                        <span className="font-semibold tabular-nums">{a.totals.byStage[s] ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </QueryState>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Needs your attention" />
          <CardBody className="grid gap-3">
            <Link
              href="/admin/companies"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-border-strong"
            >
              <span>
                <b className="tabular-nums">{companies.data?.items.length ?? "…"}</b> companies waiting for
                verification
              </span>
              <ArrowRight className="size-5 text-muted-foreground" />
            </Link>
            <Link
              href="/admin/applications?status=SUBMITTED"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-border-strong"
            >
              <span>New applications to screen</span>
              <ArrowRight className="size-5 text-muted-foreground" />
            </Link>
            <Link
              href="/admin/certificates"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-border-strong"
            >
              <span>Certificates waiting for approval</span>
              <ArrowRight className="size-5 text-muted-foreground" />
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/audit">Audit log</Link>
              </Button>
            }
          />
          <CardBody>
            {audit.isPending ? (
              <Skeleton className="h-40" />
            ) : (
              <ul className="grid gap-3">
                {audit.data?.items.slice(0, 6).map((e) => (
                  <li key={e.id} className="text-[15px]">
                    <p>
                      <b>{e.actorName ?? "System"}</b>{" "}
                      <span className="text-muted-foreground">{e.action.replace(/[._]/g, " ")}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.entityType}, {formatRelative(e.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
