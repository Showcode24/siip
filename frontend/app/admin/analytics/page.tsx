"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/client/api/admin";
import { errorMessage } from "@/client/api/http";
import { FunnelChart, SkillsChart } from "@/components/admin/charts";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui/display";
import { Select } from "@/components/ui/form-controls";
import { downloadFile } from "@/lib/csv";

const pct = (v: number | null) => (v === null ? "No data" : `${v}%`);

export default function AnalyticsPage() {
  const cohorts = useQuery({ queryKey: ["admin", "cohorts"], queryFn: adminApi.listCohorts });
  const [cohortId, setCohortId] = useState("");
  const q = useQuery({
    queryKey: ["admin", "analytics", cohortId],
    queryFn: () => adminApi.getAnalytics(cohortId || undefined),
  });
  const exportCsv = async (kind: "applications" | "placements") => {
    try {
      downloadFile(
        `siip-${kind}-${new Date().toISOString().slice(0, 10)}.csv`,
        await adminApi.exportCsv(kind, { cohortId: cohortId || undefined }),
      );
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Pass, placement and completion rates, and the skills companies need."
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv("applications")}>
              <Download /> Applications CSV
            </Button>
            <Button variant="outline" onClick={() => exportCsv("placements")}>
              <Download /> Placements CSV
            </Button>
          </>
        }
      />
      <div className="mb-6 w-64">
        <label htmlFor="ac" className="sr-only">
          Cohort
        </label>
        <Select id="ac" value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">All cohorts</option>
          {cohorts.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <QueryState query={q}>
        {(a) => (
          <div className="grid gap-6 [&>*]:min-w-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Assessment pass rate"
                value={pct(a.rates.assessmentPassRate)}
                hint={`${a.counts.assessmentPasses} of ${a.counts.assessmentAttempts} attempts`}
              />
              <StatCard label="Placement rate" value={pct(a.rates.placementRate)} />
              <StatCard label="Completion rate" value={pct(a.rates.completionRate)} />
              <StatCard label="Permanent offer rate" value={pct(a.rates.permanentOfferRate)} tone="brand" />
            </div>
            <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
              <Card>
                <CardHeader title="Funnel" />
                <CardBody>
                  <FunnelChart byStage={a.totals.byStage} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Skills: demand vs supply" />
                <CardBody>
                  <SkillsChart skills={a.skills} />
                </CardBody>
              </Card>
            </div>
            <Card>
              <CardHeader
                title="Skill gaps"
                description="Positive gap: more demand than graduates with the skill."
              />
              <CardBody className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-[15px]">
                  <thead className="text-sm text-muted-foreground">
                    <tr>
                      <th className="py-2 font-semibold">Skill</th>
                      <th className="font-semibold">Demand</th>
                      <th className="font-semibold">Supply</th>
                      <th className="font-semibold">Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.skills.map((s) => (
                      <tr key={s.skillId} className="border-t border-border">
                        <td className="py-2.5">{s.name}</td>
                        <td className="tabular-nums">{s.demand}</td>
                        <td className="tabular-nums">{s.supply}</td>
                        <td
                          className={
                            s.gap > 0
                              ? "font-semibold text-brand-text tabular-nums"
                              : "text-muted-foreground tabular-nums"
                          }
                        >
                          {s.gap > 0 ? `+${s.gap}` : s.gap}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          </div>
        )}
      </QueryState>
    </>
  );
}
