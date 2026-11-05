"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ApplicationStatus } from "@siip/shared/enums";
import type { Analytics } from "@/client/api/types";
import { formatNumber } from "@/lib/utils";

const tooltipStyle = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "var(--shadow-md)",
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600 },
  cursor: { fill: "var(--surface-muted)" },
};
const axis = { stroke: "var(--muted-foreground)", fontSize: 13, tickLine: false, axisLine: false } as const;

/** Funnel stages: how many applications reached each stage or beyond. */
const FUNNEL: Array<{ label: string; statuses: ApplicationStatus[] }> = [
  {
    label: "Registered",
    statuses: [
      "SUBMITTED",
      "SCREENING",
      "SHORTLISTED",
      "IN_TRAINING",
      "FINAL_ASSESSMENT",
      "QUALIFIED",
      "MATCHED",
      "PLACED",
      "COMPLETED",
      "REJECTED",
      "WITHDRAWN",
    ],
  },
  {
    label: "Shortlisted",
    statuses: [
      "SHORTLISTED",
      "IN_TRAINING",
      "FINAL_ASSESSMENT",
      "QUALIFIED",
      "MATCHED",
      "PLACED",
      "COMPLETED",
    ],
  },
  { label: "Trained", statuses: ["FINAL_ASSESSMENT", "QUALIFIED", "MATCHED", "PLACED", "COMPLETED"] },
  { label: "Qualified", statuses: ["QUALIFIED", "MATCHED", "PLACED", "COMPLETED"] },
  { label: "Placed", statuses: ["PLACED", "COMPLETED"] },
  { label: "Completed", statuses: ["COMPLETED"] },
];

export function funnelData(byStage: Analytics["totals"]["byStage"]) {
  return FUNNEL.map((f) => ({
    stage: f.label,
    count: f.statuses.reduce((n, s) => n + (byStage[s] ?? 0), 0),
  }));
}

export function FunnelChart({ byStage }: { byStage: Analytics["totals"]["byStage"] }) {
  const data = funnelData(byStage);
  const summary = data.map((d) => `${d.stage} ${d.count}`).join(", ");
  return (
    <figure>
      <div className="h-72" role="img" aria-label={`Programme funnel: ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} {...axis} />
            <YAxis type="category" dataKey="stage" width={92} {...axis} />
            <Tooltip {...tooltipStyle} formatter={(v) => [formatNumber(Number(v)), "Graduates"]} />
            <Bar
              dataKey="count"
              fill="var(--primary)"
              radius={[0, 8, 8, 0]}
              barSize={22}
              isAnimationActive={
                typeof window !== "undefined" &&
                !window.matchMedia("(prefers-reduced-motion: reduce)").matches
              }
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Graduates</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.stage}>
                <td>{d.stage}</td>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

export function SkillsChart({ skills }: { skills: Analytics["skills"] }) {
  const data = skills.slice(0, 8).map((s) => ({ name: s.name, Demand: s.demand, Supply: s.supply }));
  return (
    <figure>
      <div
        className="h-80"
        role="img"
        aria-label={`Skills in demand versus supply: ${data.map((d) => `${d.name} demand ${d.Demand}, supply ${d.Supply}`).join("; ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} {...axis} />
            <YAxis type="category" dataKey="name" width={150} {...axis} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, color: "var(--muted-foreground)" }} />
            <Bar dataKey="Demand" fill="var(--primary)" radius={[0, 6, 6, 0]} barSize={10} />
            <Bar dataKey="Supply" fill="var(--secondary)" radius={[0, 6, 6, 0]} barSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        Demand counts opening slots asking for each skill; supply counts graduates in the programme with it.
      </figcaption>
    </figure>
  );
}
