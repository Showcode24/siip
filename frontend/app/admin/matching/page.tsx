"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, MapPin, Search, Send } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/client/api/admin";
import { errorMessage } from "@/client/api/http";
import type { Suggestion } from "@/client/api/types";
import { ScoreBreakdownList, ScoreRing } from "@/components/company/shared";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState, PageHeader, Skeleton } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form-controls";
import { AVAILABILITY, WORK_MODE, formatLocation } from "@/lib/labels";
import { SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";

export default function MatchingPage() {
  const openings = useQuery({
    queryKey: ["admin", "openings", "OPEN"],
    queryFn: () => adminApi.listOpenings("OPEN"),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const list = useMemo(
    () =>
      (openings.data?.items ?? []).filter((o) =>
        `${o.title} ${o.company?.name}`.toLowerCase().includes(filter.toLowerCase()),
      ),
    [openings.data, filter],
  );
  const active = selected ?? list[0]?.id ?? null;

  return (
    <>
      <PageHeader
        title="Matching"
        description="Pick an opening to see qualified graduates ranked by fit, then propose the best ones to the company."
      />
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside aria-label="Open openings" className="grid content-start gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter openings"
              aria-label="Filter openings"
              className="h-11 pl-10"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="lg:hidden">
            <Select aria-label="Opening" value={active ?? ""} onChange={(e) => setSelected(e.target.value)}>
              {list.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}, {o.company?.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="hidden max-h-[calc(100dvh-260px)] gap-2 overflow-y-auto pr-1 lg:grid">
            {openings.isPending
              ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
              : list.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSelected(o.id)}
                    aria-pressed={active === o.id}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      active === o.id
                        ? "border-primary bg-primary-soft/40"
                        : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <p className="font-semibold">{o.title}</p>
                    <p className="text-sm text-muted-foreground">{o.company?.name}</p>
                    <p className="mt-2 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {o.state}, {WORK_MODE[o.workMode]}
                      </span>
                      <span className="tabular-nums">
                        {o._count.placements}/{o.slots} filled
                      </span>
                    </p>
                  </button>
                ))}
            {!openings.isPending && !list.length ? (
              <p className="p-4 text-sm text-muted-foreground">No open openings.</p>
            ) : null}
          </div>
        </aside>
        <section aria-live="polite">
          {active ? (
            <Suggestions openingId={active} />
          ) : (
            <EmptyState
              title="No open openings"
              description="Companies need verified, published openings before you can match."
            />
          )}
        </section>
      </div>
    </>
  );
}

function Suggestions({ openingId }: { openingId: string }) {
  const qc = useQueryClient();
  const key = ["admin", "suggestions", openingId];
  const q = useQuery({ queryKey: key, queryFn: () => adminApi.getSuggestions(openingId, 30) });
  const [proposed, setProposed] = useState<Set<string>>(new Set());
  const reduce = useReducedMotion();
  const propose = useMutation({
    mutationFn: (s: Suggestion) => adminApi.proposeMatch(openingId, s.applicationId),
    onSuccess: (_, s) => {
      setProposed((p) => new Set(p).add(s.applicationId));
      qc.invalidateQueries({ queryKey: ["admin", "openings"] });
      toast.success(`${s.graduate.firstName} proposed`, { description: "The company has been notified." });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <QueryState query={q}>
      {({ opening, suggestions }) => (
        <div className="grid gap-4">
          <Card className="bg-night-2 text-white">
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--grey-200)]">{opening.company.name}</p>
                <h2 className="text-2xl">{opening.title}</h2>
              </div>
              <p className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
                {opening.filled} of {opening.slots} slots filled
              </p>
            </CardBody>
          </Card>
          {suggestions.length === 0 ? (
            <EmptyState
              title="No qualified graduates fit this opening"
              description="Graduates appear here once they've qualified and aren't already matched."
            />
          ) : (
            <ol className="grid gap-3">
              {[...suggestions]
                .sort((a, b) => Number(proposed.has(a.applicationId)) - Number(proposed.has(b.applicationId)))
                .map((s) => {
                const done = proposed.has(s.applicationId);
                const i = suggestions.indexOf(s);
                return (
                  <motion.li
                    key={s.applicationId}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING, delay: reduce ? 0 : Math.min(i, 8) * 0.04, layout: SPRING }}
                    className={cn(
                      "rounded-xl border border-border bg-surface shadow-sm transition-opacity",
                      done && "opacity-60",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                      <span className="w-6 text-center font-display text-lg font-semibold text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                      <ScoreRing score={s.score} size={56} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {s.graduate.firstName} {s.graduate.lastName}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {[s.graduate.courseOfStudy, s.graduate.institution, formatLocation(s.graduate)]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {s.graduate.skills.slice(0, 3).map((k) => (
                            <Badge key={k.id} className="h-6 text-xs">
                              {k.name}
                            </Badge>
                          ))}
                          {s.graduate.availability ? (
                            <Badge tone="info" className="h-6 text-xs">
                              {AVAILABILITY[s.graduate.availability]}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        onClick={() => propose.mutate(s)}
                        disabled={
                          done || (propose.isPending && propose.variables?.applicationId === s.applicationId)
                        }
                        loading={propose.isPending && propose.variables?.applicationId === s.applicationId}
                        variant={done ? "outline" : "primary"}
                      >
                        {done ? (
                          <>
                            <Check /> Proposed
                          </>
                        ) : (
                          <>
                            <Send /> Propose
                          </>
                        )}
                      </Button>
                    </div>
                    <details className="group border-t border-border">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 text-sm font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
                        Why this score{" "}
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="px-5 pb-5">
                        <ScoreBreakdownList breakdown={s.breakdown} />
                      </div>
                    </details>
                  </motion.li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </QueryState>
  );
}
