"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema } from "@siip/shared/validators/auth";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { authApi } from "@/client/api/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/form-controls";
import { handleFormError } from "@/lib/forms";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
  });
  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await authApi.forgotPassword(email);
      setSentTo(email);
    } catch (err) {
      handleFormError(err, setError);
    }
  });

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary-soft text-brand-text">
          <MailCheck className="size-8" />
        </span>
        <h1 className="mt-6 text-[32px]">Check your email</h1>
        <p className="mt-3 text-muted-foreground">
          If <b className="text-foreground">{sentTo}</b> has a SIIP account, we&apos;ve sent a link to reset
          your password. It expires in 1 hour.
        </p>
        <Button asChild size="lg" variant="outline" className="mt-8 w-full">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-[32px]">Forgot your password?</h1>
      <p className="mt-2 text-muted-foreground">
        Enter your email and we&apos;ll send you a link to choose a new one.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <Field label="Email address" error={errors.email?.message} required>
          <Input type="email" inputMode="email" autoComplete="email" {...register("email")} />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-[15px]">
        <Link href="/sign-in" className="font-semibold text-brand-text underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
