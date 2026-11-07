"use client";

import { useQuery } from "@tanstack/react-query";
import type { MatchStatus } from "@siip/shared/enums";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { companyApi } from "@/client/api/company";
import { ScoreBreakdownList, ScoreRing } from "@/components/company/shared";
import { Segmented } from "@/components/motion";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState, PageHeader, StatusPill } from "@/components/ui/display";
import { MATCH_STATUS } from "@/lib/labels";
import { cn, formatRelative } from "@/lib/utils";

const FILTERS: Array<{ value: MatchStatus | "ALL"; label: string }> = [
  { value: "PROPOSED", label: "Waiting for you" },
  { value: "COMPANY_ACCEPTED", label: "Accepted" },
  { value: "COMPANY_REJECTED", label: "Declined" },
  { value: "ALL", label: "All" },
];

export default function MatchesPage() {
  const [filter, setFilter] = useState<MatchStatus | "ALL">("PROPOSED");
  const q = useQuery({ queryKey: ["company", "matches"], queryFn: companyApi.listMatches });
  return (
    <>
      <PageHeader
        title="Candidates"
        description="Graduates SIIP has matched to your openings. Contact details are shared once you accept."
      />
      <Segmented
        className="mb-5"
        label="Filter candidates"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({
          value: f.value,
          label: f.label,
          count: f.value === "ALL" ? q.data?.items.length : q.data?.items.filter((m) => m.status === f.value).length,
        }))}
      />
      <QueryState query={q}>
        {({ items }) => {
          const list = filter === "ALL" ? items : items.filter((m) => m.status === filter);
          if (!list.length)
            return (
              <EmptyState
                title={filter === "PROPOSED" ? "No candidates waiting" : "Nothing here"}
                description="We'll notify you when SIIP proposes a graduate for one of your openings."
              />
            );
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              {list.map((m) => (
                <Card key={m.id} className={cn(m.status === "PROPOSED" && "border-primary/40")}>
                  <CardBody className="grid gap-5">
                    <div className="flex items-start gap-4">
                      <ScoreRing score={m.score} size={72} />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-xl font-semibold">
                          {m.graduate.firstName} {m.graduate.lastName}
                        </p>
                        <p className="text-[15px] text-muted-foreground">
                          {[m.graduate.courseOfStudy, m.graduate.institution].filter(Boolean).join(", ")}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          For {m.opening.title}, {formatRelative(m.createdAt)}
                        </p>
                      </div>
                      <StatusPill map={MATCH_STATUS} value={m.status} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {m.graduate.skills.slice(0, 4).map((s) => (
                        <Badge key={s.id}>{s.name}</Badge>
                      ))}
                    </div>
                    <details className="group rounded-lg bg-surface-muted p-4">
                      <summary className="cursor-pointer list-none text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                        Why this match
                      </summary>
                      <div className="mt-4">
                        <ScoreBreakdownList breakdown={m.scoreBreakdown} compact />
                      </div>
                    </details>
                    <Button asChild variant={m.status === "PROPOSED" ? "primary" : "outline"}>
                      <Link href={`/company/matches/${m.id}`}>
                        {m.status === "PROPOSED" ? "Review and decide" : "View"} <ArrowRight />
                      </Link>
                    </Button>
                  </CardBody>
                </Card>
              ))}
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
