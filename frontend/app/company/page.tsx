"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, ClipboardCheck, GitPullRequest, Users } from "lucide-react";
import Link from "next/link";
import { companyApi } from "@/client/api/company";
import { useSession } from "@/client/session";
import { ScoreRing } from "@/components/company/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
  StatusPill,
} from "@/components/ui/display";
import { PLACEMENT_STATUS } from "@/lib/labels";
import { formatDate, formatRelative } from "@/lib/utils";

const DAY = 86_400_000;

export default function CompanyDashboard() {
  const { me } = useSession();
  const openings = useQuery({ queryKey: ["company", "openings"], queryFn: () => companyApi.listOpenings() });
  const matches = useQuery({ queryKey: ["company", "matches"], queryFn: companyApi.listMatches });
  const interns = useQuery({ queryKey: ["company", "interns"], queryFn: companyApi.listInterns });
  const pending = matches.data?.items.filter((m) => m.status === "PROPOSED") ?? [];
  const active = interns.data?.items.filter((p) => p.status === "ACTIVE") ?? [];
  const dueEval = active.filter((p) => new Date(p.endDate).getTime() - Date.now() < 14 * DAY);
  const loading = openings.isPending || matches.isPending || interns.isPending;

  return (
    <>
      <PageHeader
        title={me?.companyMember?.company.name ?? "Dashboard"}
        description="Your openings, candidates and interns at a glance."
        actions={
          <Button asChild>
            <Link href="/company/openings/new">Post an opening</Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Decisions waiting"
              value={pending.length}
              hint={pending.length ? "Please decide within 3 days" : "You're all caught up"}
              icon={<GitPullRequest />}
              tone={pending.length ? "brand" : "default"}
            />
            <StatCard
              label="Open openings"
              value={openings.data?.items.filter((o) => o.status === "OPEN").length ?? 0}
              icon={<Briefcase />}
            />
            <StatCard label="Active interns" value={active.length} icon={<Users />} />
            <StatCard
              label="Evaluations due soon"
              value={dueEval.length}
              hint="Within 14 days of the end date"
              icon={<ClipboardCheck />}
              tone={dueEval.length ? "dark" : "default"}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Candidates waiting for you"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/company/matches">See all</Link>
              </Button>
            }
          />
          <CardBody>
            {matches.isPending ? (
              <Skeleton className="h-40" />
            ) : pending.length === 0 ? (
              <EmptyState
                className="border-0 py-8"
                title="No candidates waiting"
                description="We'll notify you when SIIP proposes a graduate for one of your openings."
              />
            ) : (
              <ul className="grid gap-3">
                {pending.slice(0, 4).map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/company/matches/${m.id}`}
                      className="flex items-center gap-4 rounded-lg border border-border p-4 hover:border-border-strong"
                    >
                      <ScoreRing score={m.score} size={52} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {m.graduate.firstName} {m.graduate.lastName}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {m.opening.title}, proposed {formatRelative(m.createdAt)}
                        </p>
                      </div>
                      <ArrowRight className="size-5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Your interns"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/company/interns">See all</Link>
              </Button>
            }
          />
          <CardBody>
            {interns.isPending ? (
              <Skeleton className="h-40" />
            ) : !interns.data?.items.length ? (
              <EmptyState
                className="border-0 py-8"
                title="No interns yet"
                description="Accepted candidates appear here with their dates and supervisor."
              />
            ) : (
              <ul className="grid gap-3">
                {interns.data.items.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/company/interns/${p.id}`}
                      className="flex items-center gap-4 rounded-lg border border-border p-4 hover:border-border-strong"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {p.graduate.firstName} {p.graduate.lastName}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {p.opening.title}, ends {formatDate(p.endDate)}
                        </p>
                      </div>
                      <StatusPill map={PLACEMENT_STATUS} value={p.status} />
                    </Link>
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
