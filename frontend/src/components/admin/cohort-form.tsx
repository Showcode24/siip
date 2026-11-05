"use client";

import { cohortDateProblem } from "@siip/shared/validators/cohort";
import { useState } from "react";
import type { AdminCohort } from "@/client/api/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/form-controls";

const DATES = [
  ["applicationOpensAt", "Applications open"],
  ["applicationClosesAt", "Applications close"],
  ["trainingStartsAt", "Training starts"],
  ["trainingEndsAt", "Training ends"],
  ["internshipStartsAt", "Internships start"],
  ["internshipEndsAt", "Internships end"],
] as const;
type DateKey = (typeof DATES)[number][0];

export interface CohortFormValues {
  name: string;
  description: string;
  capacity: number;
  dates: Record<DateKey, string>;
}

const day = (iso?: string) => (iso ? iso.slice(0, 10) : "");

export function CohortForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial?: AdminCohort;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (
    v: { name: string; description: string | null; capacity: number } & Record<DateKey, Date>,
  ) => void;
}) {
  const [v, setV] = useState<CohortFormValues>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    capacity: initial?.capacity ?? 60,
    dates: Object.fromEntries(DATES.map(([k]) => [k, day(initial?.[k])])) as Record<DateKey, string>,
  });
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (v.name.trim().length < 3) return setError("Give the cohort a name of at least 3 characters.");
        if (DATES.some(([k]) => !v.dates[k])) return setError("Fill in every date.");
        const dates = Object.fromEntries(
          DATES.map(([k]) => [k, new Date(`${v.dates[k]}T09:00:00+01:00`)]),
        ) as Record<DateKey, Date>;
        const problem = cohortDateProblem(dates);
        if (problem) return setError(problem);
        setError(null);
        onSubmit({
          name: v.name.trim(),
          description: v.description.trim() || null,
          capacity: v.capacity,
          ...dates,
        });
      }}
    >
      <Field label="Name" required>
        <Input
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          placeholder="e.g. Cohort 4 · 2027"
        />
      </Field>
      <Field label="Description" optional>
        <Textarea
          rows={2}
          value={v.description}
          onChange={(e) => setV({ ...v, description: e.target.value })}
        />
      </Field>
      <Field label="Capacity" hint="How many graduates can be shortlisted." required>
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          className="max-w-40"
          value={v.capacity}
          onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {DATES.map(([k, label]) => (
          <Field key={k} label={label} required>
            <Input
              type="date"
              value={v.dates[k]}
              onChange={(e) => setV({ ...v, dates: { ...v.dates, [k]: e.target.value } })}
            />
          </Field>
        ))}
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-[15px] font-medium text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={busy} className="justify-self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
