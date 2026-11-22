"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema } from "@siip/shared/validators/auth";
import { Building2, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { authApi } from "@/client/api/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox, Input, RadioCard, RadioGroup } from "@/components/ui/form-controls";
import { handleFormError } from "@/lib/forms";

type Values = z.input<typeof signUpSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    setError,
    formState: { errors: formErrors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(signUpSchema),
    mode: "onTouched",
    defaultValues: { accountType: "GRADUATE", email: "", password: "" },
  });
  // The two account types have different fields; read errors by name.
  const errors = formErrors as Partial<Record<string, { message?: string }>>;
  const isCompany = watch("accountType") === "COMPANY";
  // WhatsApp is usually the same number as the phone.
  const [whatsappSame, setWhatsappSame] = useState(true);
  const phone = watch("phone" as never) as unknown as string | undefined;
  useEffect(() => {
    if (isCompany && whatsappSame) setValue("whatsapp" as never, (phone ?? "") as never);
  }, [isCompany, whatsappSame, phone, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.signUp(values);
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      handleFormError(err, setError);
    }
  });

  return (
    <>
      <h1 className="text-[32px]">Create your account</h1>
      <p className="mt-2 text-muted-foreground">It&apos;s free and takes about two minutes.</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold">I am…</legend>
          <Controller
            control={control}
            name="accountType"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid-cols-2">
                <RadioCard value="GRADUATE">
                  <GraduationCap className="mb-1 size-5 text-brand-text" />
                  <span className="block font-semibold">An intern</span>
                  <span className="block text-sm text-muted-foreground">Student, graduate or corps member</span>
                </RadioCard>
                <RadioCard value="COMPANY">
                  <Building2 className="mb-1 size-5 text-brand-text" />
                  <span className="block font-semibold">A company</span>
                  <span className="block text-sm text-muted-foreground">hiring interns</span>
                </RadioCard>
              </RadioGroup>
            )}
          />
        </fieldset>
        {isCompany ? (
          <>
            <Field label="Company name" error={errors.companyName?.message} required>
              <Input autoComplete="organization" {...register("companyName" as never)} />
            </Field>
            <Field
              label="RC number"
              hint="Your CAC registration number, e.g. RC1234567."
              error={errors.registrationNumber?.message}
              required
            >
              <Input autoCapitalize="characters" {...register("registrationNumber" as never)} />
            </Field>
            <Field label="Address" error={errors.address?.message} required>
              <Input autoComplete="street-address" {...register("address" as never)} />
            </Field>
            <Field label="Phone number" error={errors.phone?.message} required>
              <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+234" {...register("phone" as never)} />
            </Field>
            <div className="grid gap-3">
              <label className="flex items-center gap-3 text-[15px]">
                <Checkbox checked={whatsappSame} onCheckedChange={(v) => setWhatsappSame(v === true)} />
                WhatsApp number is the same as the phone number
              </label>
              {whatsappSame ? null : (
                <Field label="WhatsApp number" error={errors.whatsapp?.message} required>
                  <Input type="tel" inputMode="tel" placeholder="+234" {...register("whatsapp" as never)} />
                </Field>
              )}
              {whatsappSame && errors.whatsapp?.message && !errors.phone?.message ? (
                <p className="text-sm text-danger">{errors.whatsapp.message}</p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First name" error={errors.firstName?.message} required>
              <Input autoComplete="given-name" {...register("firstName" as never)} />
            </Field>
            <Field label="Last name" error={errors.lastName?.message} required>
              <Input autoComplete="family-name" {...register("lastName" as never)} />
            </Field>
          </div>
        )}
        <Field label="Email address" error={errors.email?.message} required>
          <Input type="email" inputMode="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field
          label="Password"
          hint="At least 8 characters, with a letter and a number."
          error={errors.password?.message}
          required
        >
          <PasswordInput
            show={showPw}
            onToggle={() => setShowPw(!showPw)}
            autoComplete="new-password"
            {...register("password")}
          />
        </Field>
        <Controller
          control={control}
          name="consent"
          render={({ field }) => (
            <div>
              <label className="flex items-start gap-3 text-[15px]">
                <Checkbox
                  className="mt-0.5"
                  checked={field.value === true}
                  onCheckedChange={(v) => field.onChange(v === true ? true : undefined)}
                  aria-invalid={errors.consent ? true : undefined}
                />
                <span>
                  I agree to SIIP using my data as described in the{" "}
                  <Link
                    href="/privacy"
                    className="font-semibold text-brand-text underline underline-offset-4"
                  >
                    privacy notice
                  </Link>
                  , in line with the Nigeria Data Protection Act 2023.
                </span>
              </label>
              {errors.consent ? (
                <p role="alert" className="mt-2 text-sm font-medium text-danger">
                  {errors.consent.message}
                </p>
              ) : null}
            </div>
          )}
        />
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-[15px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-brand-text underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
