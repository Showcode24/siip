"use client";

// Profile sections shared by onboarding (as wizard steps) and settings (as tabs).
// Each section validates with the backend's own schema and saves itself.
import { zodResolver } from "@hookform/resolvers/zod";
import { Availability, DegreeClass, NyscStatus, SkillLevel } from "@siip/shared/enums";
import { NIGERIAN_STATES } from "@siip/shared/nigeria";
import { updateProfileSchema } from "@siip/shared/validators/graduate";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { graduateApi } from "@/client/api/graduate";
import { errorMessage } from "@/client/api/http";
import type { GraduateProfile } from "@/client/api/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import { AVAILABILITY, DEGREE_CLASS, NYSC_STATUS, SKILL_LEVEL } from "@/lib/labels";
import { handleFormError } from "@/lib/forms";
import { cn, formatDate } from "@/lib/utils";

type ProfileInput = z.input<typeof updateProfileSchema>;
export const profileKey = ["graduate", "profile"] as const;

export interface SectionProps {
  profile: GraduateProfile;
  /** Called after a successful save (the wizard moves to the next step). */
  onSaved?: () => void;
  submitLabel?: string;
  /** Extra buttons next to submit (e.g. "Back" in the wizard). */
  extra?: ReactNode;
}

function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: graduateApi.updateProfile,
    onSuccess: (p) => qc.setQueryData(profileKey, p),
  });
}

/** Keeps unsaved typing in localStorage so a dropped connection doesn't lose it. */
function useDraft<T extends FieldValues>(key: string, form: UseFormReturn<T>) {
  const storageKey = `siip-draft-${key}`;
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const values = JSON.parse(saved) as Partial<T>;
        Object.entries(values).forEach(([k, v]) =>
          form.setValue(k as never, v as never, { shouldDirty: true }),
        );
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
    const sub = form.watch((v) => localStorage.setItem(storageKey, JSON.stringify(v)));
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  return () => localStorage.removeItem(storageKey);
}

function useSectionForm<K extends keyof ProfileInput>(key: string, keys: K[], profile: GraduateProfile) {
  // pick() needs a literal mask; the keys are checked by the K constraint above.
  const schema = updateProfileSchema.pick(Object.fromEntries(keys.map((k) => [k, true])) as never);
  const defaults = Object.fromEntries(
    keys.map((k) => [k, (profile as unknown as Record<string, unknown>)[k as string] ?? ""]),
  ) as Pick<ProfileInput, K>;
  const form = useForm<Pick<ProfileInput, K>>({
    resolver: zodResolver(schema) as never,
    mode: "onTouched",
    defaultValues: defaults as never,
  });
  const clearDraft = useDraft(key, form as unknown as UseFormReturn<FieldValues>);
  return { form, clearDraft };
}

function Actions({
  loading,
  submitLabel = "Save",
  extra,
}: {
  loading: boolean;
  submitLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
      <div>{extra}</div>
      <Button type="submit" size="lg" loading={loading}>
        {submitLabel}
      </Button>
    </div>
  );
}

const nullIfEmpty = <T extends Record<string, unknown>>(v: T) =>
  Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? null : x])) as T;

// ─── Personal ─────────────────────────────────────────────────────────────────

export function PersonalSection({ profile, onSaved, submitLabel, extra }: SectionProps) {
  const save = useSaveProfile();
  const { form, clearDraft } = useSectionForm(
    "personal",
    ["firstName", "lastName", "otherNames", "phone", "stateOfResidence", "lga", "bio"],
    profile,
  );
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={handleSubmit(async (v) => {
        try {
          await save.mutateAsync(nullIfEmpty(v));
          clearDraft();
          toast.success("Saved");
          onSaved?.();
        } catch (err) {
          handleFormError(err, setError);
        }
      })}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName?.message} required>
          <Input autoComplete="given-name" {...register("firstName")} />
        </Field>
        <Field label="Last name" error={errors.lastName?.message} required>
          <Input autoComplete="family-name" {...register("lastName")} />
        </Field>
      </div>
      <Field label="Other names" optional error={errors.otherNames?.message}>
        <Input {...register("otherNames")} />
      </Field>
      <Field
        label="Phone number"
        hint="A Nigerian mobile number, e.g. 0803 123 4567."
        error={errors.phone?.message}
        required
      >
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0803 123 4567"
          {...register("phone")}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="State of residence" error={errors.stateOfResidence?.message} required>
          <Select {...register("stateOfResidence")}>
            <option value="">Choose a state</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s === "FCT" ? "FCT (Abuja)" : s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="LGA" optional hint="Your local government area." error={errors.lga?.message}>
          <Input {...register("lga")} />
        </Field>
      </div>
      <Field
        label="About you"
        optional
        hint="Two or three sentences companies will read."
        error={errors.bio?.message}
      >
        <Textarea rows={4} maxLength={1500} {...register("bio")} />
      </Field>
      <Actions loading={save.isPending} submitLabel={submitLabel} extra={extra} />
    </form>
  );
}

// ─── Education ────────────────────────────────────────────────────────────────

const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() + 1 - i);

export function EducationSection({ profile, onSaved, submitLabel, extra }: SectionProps) {
  const save = useSaveProfile();
  const { form, clearDraft } = useSectionForm(
    "education",
    ["institution", "courseOfStudy", "degreeClass", "graduationYear"],
    profile,
  );
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={handleSubmit(async (v) => {
        try {
          await save.mutateAsync(nullIfEmpty(v));
          clearDraft();
          toast.success("Saved");
          onSaved?.();
        } catch (err) {
          handleFormError(err, setError);
        }
      })}
    >
      <Field
        label="Institution"
        hint="University, polytechnic or college of education."
        error={errors.institution?.message}
        required
      >
        <Input list="institutions" {...register("institution")} />
      </Field>
      <datalist id="institutions">
        {[
          "University of Lagos",
          "University of Ibadan",
          "Obafemi Awolowo University",
          "University of Nigeria, Nsukka",
          "Ahmadu Bello University",
          "University of Benin",
          "University of Port Harcourt",
          "Covenant University",
          "Lagos State University",
          "Yaba College of Technology",
        ].map((i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
      <Field label="Course of study" error={errors.courseOfStudy?.message} required>
        <Input {...register("courseOfStudy")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Degree class" error={errors.degreeClass?.message} optional>
          <Select {...register("degreeClass", { setValueAs: (v) => (v === "" ? null : v) })}>
            <option value="">Choose</option>
            {Object.values(DegreeClass).map((d) => (
              <option key={d} value={d}>
                {DEGREE_CLASS[d]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Graduation year" error={errors.graduationYear?.message} required>
          <Select
            {...register("graduationYear", {
              setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
            })}
          >
            <option value="">Choose</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Actions loading={save.isPending} submitLabel={submitLabel} extra={extra} />
    </form>
  );
}

// ─── NYSC & availability ──────────────────────────────────────────────────────

export function NyscSection({ profile, onSaved, submitLabel, extra }: SectionProps) {
  const save = useSaveProfile();
  const { form, clearDraft } = useSectionForm("nysc", ["nyscStatus", "currentPpa", "availability"], profile);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = form;
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={handleSubmit(async (v) => {
        try {
          await save.mutateAsync(nullIfEmpty(v));
          clearDraft();
          toast.success("Saved");
          onSaved?.();
        } catch (err) {
          handleFormError(err, setError);
        }
      })}
    >
      <Field label="NYSC status" required error={errors.nyscStatus?.message}>
        <Select {...register("nyscStatus")}>
          {Object.values(NyscStatus).map((s) => (
            <option key={s} value={s}>
              {NYSC_STATUS[s]}
            </option>
          ))}
        </Select>
      </Field>
      {watch("nyscStatus") === "SERVING" ? (
        <Field label="Place of primary assignment (PPA)" optional error={errors.currentPpa?.message}>
          <Input {...register("currentPpa")} />
        </Field>
      ) : null}
      <Field label="When can you work during the internship?" required error={errors.availability?.message}>
        <Select {...register("availability", { setValueAs: (v) => (v === "" ? null : v) })}>
          <option value="">Choose</option>
          {Object.values(Availability).map((a) => (
            <option key={a} value={a}>
              {AVAILABILITY[a]}
            </option>
          ))}
        </Select>
      </Field>
      <Actions loading={save.isPending} submitLabel={submitLabel} extra={extra} />
    </form>
  );
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export function SkillsSection({ profile, onSaved, submitLabel = "Save skills", extra }: SectionProps) {
  const qc = useQueryClient();
  const skills = useQuery({ queryKey: ["skills"], queryFn: graduateApi.listSkills, staleTime: Infinity });
  const [picked, setPicked] = useState(profile.skills.map((s) => ({ skillId: s.id, level: s.level })));
  const save = useMutation({
    mutationFn: graduateApi.setSkills,
    onSuccess: (p) => qc.setQueryData(profileKey, p),
  });
  const available = skills.data?.filter((s) => !picked.some((p) => p.skillId === s.id)) ?? [];
  const name = (id: string) =>
    skills.data?.find((s) => s.id === id)?.name ?? profile.skills.find((s) => s.id === id)?.name ?? "Skill";

  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!picked.length) return toast.error("Add at least one skill");
        try {
          await save.mutateAsync({ skills: picked });
          toast.success("Skills saved");
          onSaved?.();
        } catch (err) {
          toast.error(errorMessage(err));
        }
      }}
    >
      <p className="text-[15px] text-muted-foreground">
        Pick the skills you have and be honest about your level. Companies are matched on these.
      </p>
      {picked.length ? (
        <ul className="grid gap-2">
          {picked.map((p, i) => (
            <li
              key={p.skillId}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <span className="min-w-0 flex-1 font-semibold">{name(p.skillId)}</span>
              <label className="sr-only" htmlFor={`lvl-${p.skillId}`}>
                Level for {name(p.skillId)}
              </label>
              <Select
                id={`lvl-${p.skillId}`}
                value={p.level}
                className="h-11 w-40"
                onChange={(e) =>
                  setPicked(
                    picked.map((x, j) => (j === i ? { ...x, level: e.target.value as SkillLevel } : x)),
                  )
                }
              >
                {Object.values(SkillLevel).map((l) => (
                  <option key={l} value={l}>
                    {SKILL_LEVEL[l]}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${name(p.skillId)}`}
                onClick={() => setPicked(picked.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border-strong p-5 text-center text-sm text-muted-foreground">
          No skills yet. Add your first one below.
        </p>
      )}
      <div>
        <p className="mb-2 text-[15px] font-semibold">Add a skill</p>
        <div className="flex flex-wrap gap-2">
          {available.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPicked([...picked, { skillId: s.id, level: "BEGINNER" }])}
              className="flex h-10 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 text-sm font-medium transition-colors hover:border-foreground active:scale-[0.97]"
            >
              <Plus className="size-4" /> {s.name}
            </button>
          ))}
        </div>
      </div>
      <Actions loading={save.isPending} submitLabel={submitLabel} extra={extra} />
    </form>
  );
}

// ─── CV & photo ───────────────────────────────────────────────────────────────

export function CvSection({ profile, onSaved, submitLabel = "Continue", extra }: SectionProps) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const upload = useMutation({
    mutationFn: (file: File) => graduateApi.uploadFile("cv", file),
    onSuccess: (p) => {
      qc.setQueryData(profileKey, p);
      toast.success("CV uploaded");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const pick = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) return toast.error("Please upload a PDF file.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Your CV must be 5 MB or smaller.");
    upload.mutate(file);
  };
  return (
    <div className="grid gap-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center rounded-xl border-2 border-dashed border-border-strong bg-surface px-6 py-10 text-center transition-colors",
          drag && "border-primary bg-primary-soft/40",
        )}
      >
        {profile.cv.uploaded ? (
          <FileText className="size-10 text-success" />
        ) : (
          <UploadCloud className="size-10 text-muted-foreground" />
        )}
        <p className="mt-3 font-semibold">{profile.cv.uploaded ? "Your CV is uploaded" : "Upload your CV"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile.cv.uploaded && profile.cv.uploadedAt
            ? `Last updated ${formatDate(profile.cv.uploadedAt)}. Upload again to replace it.`
            : "PDF only, up to 5 MB. Your CV is private until a company accepts your match."}
        </p>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
          aria-label="Choose a PDF CV"
        />
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          loading={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {profile.cv.uploaded ? "Replace CV" : "Choose a PDF"}
        </Button>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <div>{extra}</div>
        {onSaved ? (
          <Button size="lg" onClick={onSaved} disabled={!profile.cv.uploaded}>
            {submitLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
