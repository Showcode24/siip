"use client";

// Profile sections shared by onboarding (as wizard steps) and settings (as tabs).
// Each section validates with the backend's own schema and saves itself.
import { zodResolver } from "@hookform/resolvers/zod";
import { countryOptions } from "@siip/shared/countries";
import { Availability, DegreeClass, InternType } from "@siip/shared/enums";
import { NIGERIAN_STATES } from "@siip/shared/nigeria";
import { updateProfileSchema } from "@siip/shared/validators/graduate";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { graduateApi } from "@/client/api/graduate";
import { errorMessage } from "@/client/api/http";
import type { GraduateProfile } from "@/client/api/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SkillsWithProof } from "@/components/graduate/skills-proof";
import { Combobox } from "@/components/ui/combobox";
import { Input, RadioCard, RadioGroup, Select, Textarea } from "@/components/ui/form-controls";
import { AVAILABILITY, DEGREE_CLASS, INTERN_TYPE, WORK_MODE } from "@/lib/labels";
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

const COUNTRY_OPTIONS = countryOptions().map((c) => ({ value: c.code, label: c.name }));

export function PersonalSection({ profile, onSaved, submitLabel, extra }: SectionProps) {
  const save = useSaveProfile();
  const { form, clearDraft } = useSectionForm(
    "personal",
    ["firstName", "lastName", "otherNames", "phone", "country", "city", "stateOfResidence", "lga", "bio"],
    profile,
  );
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = form;
  const inNigeria = watch("country") === "NG";
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
        hint="Include your country code, e.g. +44 7700 900123."
        error={errors.phone?.message}
        required
      >
        <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+44 7700 900123" {...register("phone")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Country" error={errors.country?.message} required>
          <Controller
            control={control}
            name="country"
            render={({ field }) => (
              <Combobox
                options={COUNTRY_OPTIONS}
                value={field.value as string | null}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Search countries"
                emptyText="No country by that name"
              />
            )}
          />
        </Field>
        <Field label="City" error={errors.city?.message} required>
          <Input autoComplete="address-level2" {...register("city")} />
        </Field>
      </div>
      {inNigeria ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="State" optional error={errors.stateOfResidence?.message}>
            <Select {...register("stateOfResidence", { setValueAs: (v) => (v === "" ? null : v) })}>
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
      ) : null}
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

// ─── You and work: intern type, NYSC details, work preference ─────────────────

export function WorkSection({ profile, onSaved, submitLabel, extra }: SectionProps) {
  const save = useSaveProfile();
  const { form, clearDraft } = useSectionForm(
    "work",
    ["internType", "nyscStateCode", "nyscBatch", "currentPpa", "workPreference", "availability"],
    profile,
  );
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = form;
  const isCorpsMember = watch("internType") === "NYSC_CORPS_MEMBER";
  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={handleSubmit(async (v) => {
        if (v.internType === "NYSC_CORPS_MEMBER" && !v.nyscStateCode) {
          return setError("nyscStateCode", { message: "Enter your state code" });
        }
        if (!v.workPreference) return setError("workPreference", { message: "Choose how you want to work" });
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
      <fieldset className="grid gap-3">
        <legend className="mb-3 text-[15px] font-semibold">
          Which describes you? <span className="text-brand-text">*</span>
        </legend>
        <Controller
          control={control}
          name="internType"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="sm:grid-cols-3">
              {Object.values(InternType).map((t) => (
                <RadioCard key={t} value={t}>
                  <span className="block font-semibold">{INTERN_TYPE[t].label}</span>
                  <span className="block text-sm text-muted-foreground">{INTERN_TYPE[t].hint}</span>
                </RadioCard>
              ))}
            </RadioGroup>
          )}
        />
      </fieldset>

      {isCorpsMember ? (
        <div className="grid gap-5 rounded-lg border border-border bg-surface-muted/50 p-4 sm:p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="State code"
              hint="As on your call-up letter, e.g. LA/24A/1234."
              error={errors.nyscStateCode?.message}
              required
            >
              <Input autoCapitalize="characters" placeholder="LA/24A/1234" {...register("nyscStateCode")} />
            </Field>
            <Field label="Batch" hint="e.g. 2024 Batch A, Stream 1." error={errors.nyscBatch?.message} optional>
              <Input {...register("nyscBatch")} />
            </Field>
          </div>
          <Field label="Place of primary assignment (PPA)" optional error={errors.currentPpa?.message}>
            <Input {...register("currentPpa")} />
          </Field>
        </div>
      ) : null}

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-[15px] font-semibold">
          How do you want to work? <span className="text-brand-text">*</span>
        </legend>
        <Controller
          control={control}
          name="workPreference"
          render={({ field }) => (
            <RadioGroup
              value={(field.value as string | null) ?? ""}
              onValueChange={field.onChange}
              className="sm:grid-cols-3"
            >
              {(["REMOTE", "ONSITE", "HYBRID"] as const).map((m) => (
                <RadioCard key={m} value={m}>
                  <span className="font-semibold">{WORK_MODE[m]}</span>
                </RadioCard>
              ))}
            </RadioGroup>
          )}
        />
        {errors.workPreference?.message ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors.workPreference.message}
          </p>
        ) : null}
      </fieldset>

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

// ─── Education ────────────────────────────────────────────────────────────────

const THIS_YEAR = new Date().getFullYear();
const PAST_YEARS = Array.from({ length: 30 }, (_, i) => THIS_YEAR + 1 - i);
const FUTURE_YEARS = Array.from({ length: 8 }, (_, i) => THIS_YEAR + i);

export function EducationSection({ profile, onSaved, submitLabel, extra }: SectionProps) {
  const save = useSaveProfile();
  const studying = profile.internType === "UNDERGRADUATE";
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
          await save.mutateAsync(nullIfEmpty(studying ? { ...v, degreeClass: null } : v));
          clearDraft();
          toast.success("Saved");
          onSaved?.();
        } catch (err) {
          handleFormError(err, setError);
        }
      })}
    >
      <Field
        label={studying ? "Where you study" : "Institution"}
        hint="University, polytechnic or college."
        error={errors.institution?.message}
        required
      >
        <Input {...register("institution")} />
      </Field>
      <Field label="Course of study" error={errors.courseOfStudy?.message} required>
        <Input {...register("courseOfStudy")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        {studying ? null : (
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
        )}
        <Field
          label={studying ? "Expected graduation year" : "Graduation year"}
          error={errors.graduationYear?.message}
          required
        >
          <Select
            {...register("graduationYear", {
              setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
            })}
          >
            <option value="">Choose</option>
            {(studying ? FUTURE_YEARS : PAST_YEARS).map((y) => (
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

// ─── Skills (with proof; see skills-proof.tsx) ────────────────────────────────

export function SkillsSection({ profile, onSaved, submitLabel = "Continue", extra }: SectionProps) {
  return <SkillsWithProof profile={profile} onDone={onSaved} doneLabel={submitLabel} extra={extra} />;
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
