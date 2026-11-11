"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SkillLevel, WorkMode, WorkSchedule } from "@siip/shared/enums";
import { NIGERIAN_STATES } from "@siip/shared/nigeria";
import { createOpeningSchema } from "@siip/shared/validators/company";
import { useQuery } from "@tanstack/react-query";
import { Plus, Star, X } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";
import { graduateApi } from "@/client/api/graduate";
import type { CheckIn, LimitedGraduate, Opening, ScoreBreakdown } from "@/client/api/types";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Select, Switch, Textarea } from "@/components/ui/form-controls";
import {
  AVAILABILITY,
  DEGREE_CLASS,
  INTERN_TYPE,
  SKILL_LEVEL,
  WORK_MODE,
  WORK_SCHEDULE,
  formatLocation,
} from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";

// ─── Match score ──────────────────────────────────────────────────────────────

const FACTOR_LABEL: Record<keyof ScoreBreakdown, string> = {
  skills: "Skills",
  assessment: "Final assessment",
  discipline: "Discipline",
  location: "Location",
  availability: "Availability",
  nysc: "NYSC status",
};

export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const pct = Math.round(score);
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--primary) 0 ${pct}%, var(--surface-muted) ${pct}% 100%)`,
      }}
      role="img"
      aria-label={`Match score ${pct} out of 100`}
    >
      <span
        className="grid place-items-center rounded-full bg-surface font-display font-semibold tabular-nums"
        style={{ width: size * 0.78, height: size * 0.78, fontSize: size * 0.26 }}
      >
        {pct}
      </span>
    </div>
  );
}

/** "Why this match": each factor's points out of its weight, with the reason. */
export function ScoreBreakdownList({
  breakdown,
  compact = false,
}: {
  breakdown: ScoreBreakdown;
  compact?: boolean;
}) {
  return (
    <ul className={cn("grid", compact ? "gap-2.5" : "gap-4")}>
      {(Object.keys(FACTOR_LABEL) as Array<keyof ScoreBreakdown>).map((k) => {
        const f = breakdown[k];
        return (
          <li key={k}>
            <div className="flex items-baseline justify-between gap-3 text-[15px]">
              <span className="font-semibold">{FACTOR_LABEL[k]}</span>
              <span className="text-muted-foreground tabular-nums">
                {f.points} / {f.weight}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-secondary transition-transform duration-700 ease-out"
                style={{ width: `${Math.round(f.fit * 100)}%` }}
              />
            </div>
            {!compact ? <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Limited graduate profile (what companies see before accepting). */
export function GraduateSummary({ g }: { g: LimitedGraduate }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <Avatar name={`${g.firstName} ${g.lastName}`} src={g.photoUrl} size={56} />
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold">
            {g.firstName} {g.lastName}
          </p>
          <p className="text-[15px] text-muted-foreground">
            {[g.courseOfStudy, g.institution].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[15px]">
        {[
          ["Intern type", INTERN_TYPE[g.internType].label],
          g.internType === "UNDERGRADUATE"
            ? ["Graduates", g.graduationYear ?? "Not given"]
            : ["Degree", g.degreeClass ? DEGREE_CLASS[g.degreeClass] : "Not given"],
          ["Lives in", formatLocation(g) || "Not given"],
          ["Works", g.workPreference ? WORK_MODE[g.workPreference] : "Not given"],
          ["Availability", g.availability ? AVAILABILITY[g.availability] : "Not given"],
          [
            "Final assessment",
            g.finalAssessmentPercent !== null ? `${g.finalAssessmentPercent}%` : "Not taken",
          ],
        ].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {g.skills.length ? (
        <div className="flex flex-wrap gap-2">
          {g.skills.map((s) => (
            <Badge key={s.id} tone="neutral">
              {s.name}, {SKILL_LEVEL[s.level]}
            </Badge>
          ))}
        </div>
      ) : null}
      {g.bio ? <p className="text-[15px] text-muted-foreground">{g.bio}</p> : null}
    </div>
  );
}

// ─── Rating scale (1–5) ───────────────────────────────────────────────────────

export function RatingScale({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} out of 5`}
          onClick={() => onChange(n)}
          className={cn(
            "grid size-11 place-items-center rounded-full border-[1.5px] font-semibold transition-colors",
            value >= n
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border-strong bg-surface hover:border-foreground/40",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function CheckInList({ items }: { items: CheckIn[] }) {
  if (!items.length) return <p className="text-[15px] text-muted-foreground">No check-ins yet.</p>;
  return (
    <ol className="grid gap-3">
      {items.map((c) => (
        <li key={c.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Month {c.month}</p>
            <Badge tone={c.authorType === "INTERN" ? "info" : "dark"}>
              {c.authorType === "INTERN" ? "Intern" : "Supervisor"}
            </Badge>
            <span className="ml-auto text-sm text-muted-foreground">{formatDate(c.createdAt)}</span>
          </div>
          <p className="mt-2 text-[15px]">{c.progressNote}</p>
          {c.challenges ? (
            <p className="mt-1.5 text-sm text-muted-foreground">Challenges: {c.challenges}</p>
          ) : null}
          {c.rating ? (
            <p className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="size-4 fill-current text-brand" /> {c.rating}/5
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

// ─── Opening form (create + edit) ─────────────────────────────────────────────

export type OpeningValues = z.input<typeof createOpeningSchema>;

export function openingDefaults(o?: Opening): OpeningValues {
  return o
    ? {
        title: o.title,
        department: o.department ?? "",
        description: o.description,
        slots: o.slots,
        preferredDisciplines: o.preferredDisciplines,
        state: o.state as OpeningValues["state"],
        location: o.location ?? "",
        workMode: o.workMode,
        schedule: o.schedule,
        openToNysc: o.openToNysc,
        skills: o.skills.map((s) => ({ skillId: s.skill.id, minLevel: s.minLevel, required: s.required })),
      }
    : {
        title: "",
        department: "",
        description: "",
        slots: 1,
        preferredDisciplines: [],
        state: "Lagos",
        location: "",
        workMode: "ONSITE",
        schedule: "FULL_TIME",
        openToNysc: true,
        skills: [],
      };
}

export function OpeningForm({
  initial,
  submitLabel,
  onSubmit,
  busy,
}: {
  initial?: Opening;
  submitLabel: string;
  onSubmit: (v: OpeningValues) => Promise<void>;
  busy?: boolean;
}) {
  const skills = useQuery({ queryKey: ["skills"], queryFn: graduateApi.listSkills, staleTime: Infinity });
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OpeningValues>({
    resolver: zodResolver(createOpeningSchema),
    mode: "onTouched",
    defaultValues: openingDefaults(initial),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });
  const chosen = new Set(watch("skills").map((s) => s.skillId));
  const disciplines = watch("preferredDisciplines") ?? [];

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
      <section className="grid gap-5">
        <h2 className="text-lg">The role</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Job title" error={errors.title?.message} required>
            <Input placeholder="e.g. Social Media Intern" {...register("title")} />
          </Field>
          <Field label="Department" optional error={errors.department?.message}>
            <Input {...register("department")} />
          </Field>
        </div>
        <Field
          label="Description"
          hint="What will the intern do and learn? At least 20 characters."
          error={errors.description?.message}
          required
        >
          <Textarea rows={5} {...register("description")} />
        </Field>
        <Field label="Number of interns" error={errors.slots?.message} required>
          <Input
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            className="max-w-40"
            {...register("slots", { valueAsNumber: true })}
          />
        </Field>
      </section>

      <section className="grid gap-4 border-t border-border pt-6">
        <h2 className="text-lg">Skills needed</h2>
        {errors.skills?.message || errors.skills?.root?.message ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors.skills.message ?? errors.skills.root?.message}
          </p>
        ) : null}
        <ul className="grid gap-2">
          {fields.map((f, i) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <span className="min-w-0 flex-1 font-semibold">
                {skills.data?.find((s) => s.id === f.skillId)?.name ?? "Skill"}
              </span>
              <label className="sr-only" htmlFor={`min-${f.id}`}>
                Minimum level
              </label>
              <Select
                id={`min-${f.id}`}
                className="h-11 w-44"
                {...register(`skills.${i}.minLevel`, { setValueAs: (v) => (v === "" ? null : v) })}
              >
                <option value="">Any level</option>
                {Object.values(SkillLevel).map((l) => (
                  <option key={l} value={l}>
                    {SKILL_LEVEL[l]} or above
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={watch(`skills.${i}.required`) ?? true}
                  onCheckedChange={(v) => setValue(`skills.${i}.required`, v === true)}
                />{" "}
                Required
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove skill"
                onClick={() => remove(i)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {skills.data
            ?.filter((s) => !chosen.has(s.id))
            .map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => append({ skillId: s.id, minLevel: null, required: true })}
                className="flex h-10 items-center gap-1.5 rounded-full border border-border-strong px-4 text-sm font-medium hover:border-foreground"
              >
                <Plus className="size-4" /> {s.name}
              </button>
            ))}
        </div>
      </section>

      <section className="grid gap-5 border-t border-border pt-6">
        <h2 className="text-lg">Where and when</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="State" required>
            <Select {...register("state")}>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Office address" optional>
            <Input {...register("location")} />
          </Field>
          <Field label="Work mode" required>
            <Select {...register("workMode")}>
              {Object.values(WorkMode).map((m) => (
                <option key={m} value={m}>
                  {WORK_MODE[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Schedule" required>
            <Select {...register("schedule")}>
              {Object.values(WorkSchedule).map((m) => (
                <option key={m} value={m}>
                  {WORK_SCHEDULE[m]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Preferred disciplines"
          optional
          hint="Comma-separated, e.g. Mass Communication, Marketing. Leave empty for any."
        >
          <Input
            defaultValue={disciplines.join(", ")}
            onChange={(e) =>
              setValue(
                "preferredDisciplines",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </Field>
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
          <span>
            <span className="block font-semibold">Open to serving NYSC members</span>
            <span className="block text-sm text-muted-foreground">
              Corps members can intern around their PPA duties.
            </span>
          </span>
          <Switch checked={watch("openToNysc") ?? true} onCheckedChange={(v) => setValue("openToNysc", v)} />
        </label>
      </section>

      <div className="flex justify-end border-t border-border pt-6">
        <Button type="submit" size="lg" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
